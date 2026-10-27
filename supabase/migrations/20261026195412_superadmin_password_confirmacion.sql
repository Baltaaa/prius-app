-- Confirmación con contraseña de superadmin para acciones sensibles
-- (mini-prompt 26/10/2026). Reemplaza el gate de "escribí el nombre para
-- confirmar" (ConfirmDeleteModal) por reingresar la contraseña del
-- superadmin logueado, verificada del lado servidor (Edge Function
-- `superadmin-action`, nunca solo en el front) antes de ejecutar la acción.
--
-- Todo aditivo: tabla nueva, funciones nuevas, y solo REVOKE de EXECUTE a
-- `authenticated`/`anon` sobre las RPC destructivas existentes (nadie borra
-- ni cambia datos ahí) — ninguna lectura ni dato existente se toca.

-- 1) Lockout por usuario: 5 fallos consecutivos -> bloqueo de 15 minutos.
-- Nunca accesible por RLS directa — solo vía las funciones de abajo.
create table if not exists superadmin_intentos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fallos_consecutivos integer not null default 0,
  bloqueado_hasta timestamptz,
  updated_at timestamptz not null default now()
);
alter table superadmin_intentos enable row level security;
revoke all on superadmin_intentos from public, anon, authenticated;

-- 2) Chequear si el usuario está bloqueado ahora mismo.
create or replace function fn_superadmin_chequear_bloqueo(p_user_id uuid)
returns timestamptz
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select bloqueado_hasta from superadmin_intentos
  where user_id = p_user_id and bloqueado_hasta > now();
$function$;
revoke all on function fn_superadmin_chequear_bloqueo(uuid) from public, anon, authenticated;
grant execute on function fn_superadmin_chequear_bloqueo(uuid) to service_role;

-- 3) Registrar el resultado de un intento (éxito resetea el contador;
-- fallo lo incrementa y bloquea 15 min al llegar a 5 seguidos).
create or replace function fn_superadmin_registrar_intento(p_user_id uuid, p_exitoso boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_fallos integer;
  v_bloqueado_hasta timestamptz;
begin
  insert into superadmin_intentos (user_id, fallos_consecutivos, bloqueado_hasta, updated_at)
  values (p_user_id, case when p_exitoso then 0 else 1 end, null, now())
  on conflict (user_id) do update set
    fallos_consecutivos = case when p_exitoso then 0 else superadmin_intentos.fallos_consecutivos + 1 end,
    bloqueado_hasta = case
      when p_exitoso then null
      when superadmin_intentos.fallos_consecutivos + 1 >= 5 then now() + interval '15 minutes'
      else superadmin_intentos.bloqueado_hasta
    end,
    updated_at = now()
  returning fallos_consecutivos, superadmin_intentos.bloqueado_hasta into v_fallos, v_bloqueado_hasta;

  return jsonb_build_object('fallos_consecutivos', v_fallos, 'bloqueado_hasta', v_bloqueado_hasta);
end;
$function$;
revoke all on function fn_superadmin_registrar_intento(uuid, boolean) from public, anon, authenticated;
grant execute on function fn_superadmin_registrar_intento(uuid, boolean) to service_role;

-- 4) Log a Historial de cada intento (ok/fallido/bloqueado) — mismo patrón
-- que fn_registrar_evento_auth, pero con `datos` (acción intentada) y
-- recibiendo el user_id explícito (se llama con service_role, sin sesión
-- propia con auth.uid()).
create or replace function fn_registrar_evento_superadmin(p_user_id uuid, p_tipo_evento text, p_descripcion text, p_datos jsonb default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor_nombre text;
begin
  if p_tipo_evento not in ('superadmin_password_ok', 'superadmin_password_fallido', 'superadmin_bloqueado') then
    raise exception 'tipo_evento inválido para fn_registrar_evento_superadmin: %', p_tipo_evento;
  end if;

  select nombre into v_actor_nombre from perfiles where user_id = p_user_id;
  if v_actor_nombre is null then
    v_actor_nombre := 'Sistema';
  end if;

  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento, actor_nombre, cliente_id, cliente_nombre)
  values ('auth', 'INSERT', null, p_descripcion, current_date, p_datos, p_user_id, p_tipo_evento, v_actor_nombre, null, null);
end;
$function$;
revoke all on function fn_registrar_evento_superadmin(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function fn_registrar_evento_superadmin(uuid, text, text, jsonb) to service_role;

-- 5) RPCs nuevas para los hard-deletes que hoy son un `supabase.from(...).delete()`
-- crudo desde el cliente (reservas, clientes, reserva_clientes, leads) —
-- quedan SECURITY DEFINER (bypasean RLS, igual que cualquier función dueña
-- de la tabla) y revocadas para authenticated/anon: solo las llama el
-- dispatcher de más abajo. El DELETE de reservas/pagos vía cascada de FK
-- sigue siendo el mismo mecanismo de siempre, no se toca.
create or replace function fn_eliminar_reserva(p_reserva_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from reservas where id = p_reserva_id;
end;
$function$;
revoke all on function fn_eliminar_reserva(uuid) from public, anon, authenticated;
grant execute on function fn_eliminar_reserva(uuid) to service_role;

create or replace function fn_eliminar_cliente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from clientes where id = p_cliente_id;
end;
$function$;
revoke all on function fn_eliminar_cliente(uuid) from public, anon, authenticated;
grant execute on function fn_eliminar_cliente(uuid) to service_role;

-- Sacar un cosocio pasa a requerir superadmin + contraseña (antes: RLS
-- `usuario_activo()`, cualquier usuario activo podía hacerlo) — cambio de
-- criterio explícito de este mini-prompt ("eliminar cliente o cosocio").
create or replace function fn_quitar_cosocio(p_reserva_id uuid, p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from reserva_clientes where reserva_id = p_reserva_id and cliente_id = p_cliente_id;
end;
$function$;
revoke all on function fn_quitar_cosocio(uuid, uuid) from public, anon, authenticated;
grant execute on function fn_quitar_cosocio(uuid, uuid) to service_role;

create or replace function fn_eliminar_lead(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from leads where id = p_lead_id;
end;
$function$;
revoke all on function fn_eliminar_lead(uuid) from public, anon, authenticated;
grant execute on function fn_eliminar_lead(uuid) to service_role;

-- 6) Dispatcher único: valida que p_user_id sea superadmin activo,
-- "impersona" su auth.uid() para esta transacción (así los triggers de
-- Historial y los chequeos es_superadmin() de las RPC de abajo siguen
-- viendo al usuario real, no a service_role/Sistema) y recién ahí ejecuta
-- la acción pedida contra una lista blanca explícita — nunca un nombre de
-- función arbitrario que venga del cliente.
create or replace function fn_ejecutar_accion_superadmin(p_user_id uuid, p_accion text, p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not exists (
    select 1 from perfiles where user_id = p_user_id and activo = true and rol = 'superadmin'
  ) then
    raise exception using errcode = '42501', message = 'Solo superadmin puede ejecutar esta acción';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  case p_accion
    when 'eliminar_reserva' then
      perform fn_eliminar_reserva((p_params->>'reserva_id')::uuid);
    when 'eliminar_cliente' then
      perform fn_eliminar_cliente((p_params->>'cliente_id')::uuid);
    when 'quitar_cosocio' then
      perform fn_quitar_cosocio((p_params->>'reserva_id')::uuid, (p_params->>'cliente_id')::uuid);
    when 'eliminar_lead' then
      perform fn_eliminar_lead((p_params->>'lead_id')::uuid);
    when 'anular_pago' then
      perform anular_pago((p_params->>'pago_id')::uuid, p_params->>'motivo');
    when 'editar_comprobante' then
      perform editar_comprobante(
        (p_params->>'comprobante_id')::uuid,
        (p_params->>'monto')::numeric,
        nullif(p_params->>'fecha', '')::date,
        nullif(p_params->>'tipo', '')
      );
    when 'editar_monto_pago_vigente' then
      perform fn_editar_monto_pago_vigente((p_params->>'pago_id')::uuid, (p_params->>'monto')::numeric);
    when 'cambiar_estado_pago_manual' then
      perform cambiar_estado_pago_manual((p_params->>'reserva_id')::uuid, p_params->>'nuevo_estado', p_params->>'motivo');
    when 'revertir_estado_pago_automatico' then
      perform revertir_estado_pago_automatico((p_params->>'reserva_id')::uuid);
    when 'reabrir_caja' then
      perform reabrir_caja((p_params->>'caja_id')::uuid, p_params->>'motivo');
    else
      raise exception 'Acción superadmin no reconocida: %', p_accion;
  end case;

  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function fn_ejecutar_accion_superadmin(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function fn_ejecutar_accion_superadmin(uuid, text, jsonb) to service_role;

-- 7) Cerrar la puerta de atrás: nadie salteaba la contraseña llamando estas
-- RPC directo por API con una sesión de superadmin válida. De ahora en más
-- solo el dispatcher (como postgres, dueño de las funciones) puede
-- invocarlas — revocar el EXECUTE de `authenticated`/`anon` no afecta esa
-- llamada interna.
revoke execute on function anular_pago(uuid, text) from authenticated, anon, public;
revoke execute on function editar_comprobante(uuid, numeric, date, text) from authenticated, anon, public;
revoke execute on function fn_editar_monto_pago_vigente(uuid, numeric) from authenticated, anon, public;
revoke execute on function cambiar_estado_pago_manual(uuid, text, text) from authenticated, anon, public;
revoke execute on function revertir_estado_pago_automatico(uuid) from authenticated, anon, public;
revoke execute on function reabrir_caja(uuid, text) from authenticated, anon, public;

-- 8) Mismo cierre para el DELETE directo de reservas/clientes/reserva_clientes
-- vía REST (hoy cualquier usuario activo podía borrarlas a mano llamando la
-- API — la policy "ALL" de reservas/clientes solo chequeaba usuario_activo(),
-- sin distinguir operación). Se reemplaza la policy "ALL" por policies
-- separadas de select/insert/update (sin cambios de comportamiento ahí) y
-- se saca la de delete — las funciones SECURITY DEFINER de arriba, dueñas
-- de la tabla, siguen pudiendo borrar sin policy (igual que siempre).
drop policy if exists "auth_all_reservas" on reservas;
create policy "auth_select_reservas" on reservas for select using (usuario_activo());
create policy "auth_insert_reservas" on reservas for insert with check (usuario_activo());
create policy "auth_update_reservas" on reservas for update using (usuario_activo()) with check (usuario_activo());

drop policy if exists "auth_all_clientes" on clientes;
create policy "auth_select_clientes" on clientes for select using (usuario_activo());
create policy "auth_insert_clientes" on clientes for insert with check (usuario_activo());
create policy "auth_update_clientes" on clientes for update using (usuario_activo()) with check (usuario_activo());

drop policy if exists "reserva_clientes_delete" on reserva_clientes;

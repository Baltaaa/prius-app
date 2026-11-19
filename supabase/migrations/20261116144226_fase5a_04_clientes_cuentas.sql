-- Fase 5A, Tarea 3: vínculo entre una cuenta de Google (auth.users) y un
-- cliente del balneario. Las reglas de vínculo viven SOLO en funciones del
-- servidor (fase5a_05); los clientes nunca leen esta tabla directo.
create table if not exists public.clientes_cuentas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id),
  email text not null,
  estado text not null default 'confirmado' check (estado in ('confirmado','pendiente')),
  metodo text not null check (metodo in ('email','alta_web','dni','telefono','manual')),
  vinculado_at timestamptz not null default now(),
  confirmado_por uuid references auth.users(id),
  unique (cliente_id)
);

alter table public.clientes_cuentas enable row level security;
revoke all on table public.clientes_cuentas from anon, public;
revoke insert, delete, truncate, references, trigger on table public.clientes_cuentas from authenticated;
grant select, update on table public.clientes_cuentas to authenticated;
grant all on table public.clientes_cuentas to service_role;

create policy clientes_cuentas_select_personal on public.clientes_cuentas
  for select to authenticated using (usuario_activo());
-- Update: el permiso 'clientes.cuenta_web' es admin y superadmin (= es_admin()).
create policy clientes_cuentas_update_personal on public.clientes_cuentas
  for update to authenticated using (es_admin()) with check (es_admin());

-- Regla 1 compara clientes.mail en minúsculas y sin espacios.
create index if not exists clientes_mail_normalizado_idx
  on public.clientes (lower(btrim(mail))) where mail is not null and btrim(mail) <> '';
create index if not exists clientes_dni_idx on public.clientes (dni) where dni is not null;

-- Historial + notificación "Cuenta web pendiente de confirmar": un solo
-- trigger, así las RPCs del CRM y las funciones web no se repiten.
create or replace function public.fn_clientes_cuentas_evento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row clientes_cuentas;
  v_actor text;
  v_cliente_nombre text;
  v_tipo text;
  v_desc text;
  v_metodo text;
begin
  v_row := case when TG_OP = 'DELETE' then OLD else NEW end;
  select nullif(btrim(coalesce(nombre, '') || ' ' || coalesce(apellido, '')), '')
    into v_cliente_nombre from clientes where id = v_row.cliente_id;
  select nombre into v_actor from perfiles where user_id = auth.uid();
  v_actor := coalesce(v_actor, case when auth.uid() is not null then 'Web (cliente)' else 'Sistema' end);
  v_metodo := case v_row.metodo when 'email' then 'por email' when 'alta_web' then 'alta web'
    when 'dni' then 'por DNI' when 'telefono' then 'por teléfono' else 'manual' end;

  if TG_OP = 'INSERT' then
    v_tipo := 'cuenta_web_vinculada';
    v_desc := format('Cuenta web vinculada — %s (%s, %s)', NEW.email,
      case when NEW.estado = 'confirmado' then 'confirmada' else 'pendiente' end, v_metodo);
  elsif TG_OP = 'DELETE' then
    v_tipo := 'cuenta_web_desvinculada';
    v_desc := format('Cuenta web desvinculada — %s', OLD.email);
  elsif OLD.estado = 'pendiente' and NEW.estado = 'confirmado' then
    v_tipo := 'cuenta_web_confirmada';
    v_desc := format('Cuenta web confirmada — %s', NEW.email);
  else
    v_tipo := 'cuenta_web_editada';
    v_desc := format('Cuenta web editada — %s', NEW.email);
  end if;

  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento, actor_nombre, cliente_id, cliente_nombre)
  values ('clientes', TG_OP, v_row.cliente_id, v_desc, public.fn_hoy_ar(),
    jsonb_strip_nulls(jsonb_build_object(
      'before', case when TG_OP <> 'INSERT' then jsonb_build_object('cliente_id', OLD.cliente_id, 'email', OLD.email, 'estado', OLD.estado, 'metodo', OLD.metodo) end,
      'after', case when TG_OP <> 'DELETE' then jsonb_build_object('cliente_id', NEW.cliente_id, 'email', NEW.email, 'estado', NEW.estado, 'metodo', NEW.metodo) end)),
    auth.uid(), v_tipo, v_actor, v_row.cliente_id, v_cliente_nombre);

  if TG_OP <> 'DELETE' and NEW.estado = 'pendiente' then
    perform fn_notif_crear('pendiente', 'cuenta_web_pendiente', 'Cuenta web pendiente de confirmar',
      format('%s · %s', coalesce(v_cliente_nombre, 'Cliente'), NEW.email),
      'cliente', NEW.cliente_id, '/app/clientes?id=' || NEW.cliente_id::text, null);
  else
    perform fn_notif_resolver(v_row.cliente_id, 'cuenta_web_pendiente');
  end if;
  return null;
end;
$$;
revoke all on function public.fn_clientes_cuentas_evento() from public, anon, authenticated;

create trigger trg_clientes_cuentas_evento
  after insert or update or delete on public.clientes_cuentas
  for each row execute function public.fn_clientes_cuentas_evento();

-- Tarea 6: acciones del CRM (permiso 'clientes.cuenta_web': admin y superadmin).
create or replace function public.confirmar_cuenta_web(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row clientes_cuentas;
begin
  perform public.fn_exigir_personal();
  if not es_admin() then
    raise exception 'No tenés permiso para confirmar cuentas web.' using errcode = '42501';
  end if;
  update clientes_cuentas
     set estado = 'confirmado', confirmado_por = auth.uid()
   where cliente_id = p_cliente_id and estado = 'pendiente'
  returning * into v_row;
  if not found then
    raise exception 'Este cliente no tiene una cuenta web pendiente de confirmar.';
  end if;
  return jsonb_build_object('ok', true, 'email', v_row.email, 'estado', v_row.estado);
end;
$$;

create or replace function public.desvincular_cuenta_web(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row clientes_cuentas;
begin
  perform public.fn_exigir_personal();
  if not es_admin() then
    raise exception 'No tenés permiso para desvincular cuentas web.' using errcode = '42501';
  end if;
  delete from clientes_cuentas where cliente_id = p_cliente_id returning * into v_row;
  if not found then
    raise exception 'Este cliente no tiene una cuenta web vinculada.';
  end if;
  return jsonb_build_object('ok', true, 'email', v_row.email);
end;
$$;

revoke all on function public.confirmar_cuenta_web(uuid) from public, anon;
revoke all on function public.desvincular_cuenta_web(uuid) from public, anon;
grant execute on function public.confirmar_cuenta_web(uuid) to authenticated, service_role;
grant execute on function public.desvincular_cuenta_web(uuid) to authenticated, service_role;

-- Realtime: la ficha y Recepción se enteran del vínculo al instante (la
-- RLS de select exige usuario_activo()).
alter publication supabase_realtime add table public.clientes_cuentas;

-- fn_log_evento: un cliente web logueado (auth.uid() sin perfil) figura
-- como "Web (cliente)" en el Historial, no con actor vacío.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.fn_log_evento()'::regprocedure);
  if position('if v_actor_nombre is null and auth.uid() is null then' in d) = 0 then
    raise exception 'fn_log_evento cambió: revisar el parche a mano';
  end if;
  d := replace(d, 'if v_actor_nombre is null and auth.uid() is null then', 'if v_actor_nombre is null then');
  d := replace(d, $r$if v_origen = 'web' or TG_TABLE_NAME in ('codigos_reserva', 'leads') then$r$,
                  $r$if v_origen = 'web' or TG_TABLE_NAME in ('codigos_reserva', 'leads') or auth.uid() is not null then$r$);
  if position('or auth.uid() is not null then' in d) = 0 then
    raise exception 'fn_log_evento: no encontré la condición de origen web';
  end if;
  execute d;
end
$do$;

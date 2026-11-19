-- Fase 5A, Tarea 4: funciones del cliente logueado con Google.
-- Identidad SOLO desde auth.uid() / el JWT (mi_cuenta, completar_cuenta) o
-- desde el user_id que manda la Edge Function con service_role
-- (crear_reserva_publica). Nunca por parámetro desde el navegador.

-- ¿El proveedor (Google) verificó este email? Se mira auth.identities, que
-- escribe el proveedor; user_metadata NO sirve: el usuario lo edita con
-- updateUser().
create or replace function public.fn_cuenta_email_verificado(p_user_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_email, '') <> '' and exists (
    select 1 from auth.identities i
    where i.user_id = p_user_id
      and i.provider = 'google'
      and lower(btrim(i.identity_data->>'email')) = p_email
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
  );
$$;

-- Regla 1: email verificado que coincide con clientes.mail de EXACTAMENTE
-- un cliente sin cuenta → vínculo confirmado (metodo 'email').
create or replace function public.fn_cuenta_vincular_por_email(p_user_id uuid, p_email text, p_verificado boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
  v_id uuid;
begin
  if p_user_id is null or not coalesce(p_verificado, false) or coalesce(p_email, '') = '' then
    return false;
  end if;
  if exists (select 1 from perfiles where user_id = p_user_id) then
    return false; -- el personal del CRM nunca se vincula como cliente
  end if;
  if exists (select 1 from clientes_cuentas where user_id = p_user_id) then
    return false;
  end if;
  select count(*), (array_agg(id))[1] into v_n, v_id
  from clientes
  where mail is not null and btrim(mail) <> '' and lower(btrim(mail)) = p_email;
  if v_n <> 1 then
    return false; -- sin match o mail repetido (regla 5): sigue la regla 2
  end if;
  insert into clientes_cuentas (user_id, cliente_id, email, estado, metodo)
  values (p_user_id, v_id, p_email, 'confirmado', 'email')
  on conflict do nothing; -- cliente ya vinculado a otra cuenta: no se vincula
  return found;
end;
$$;

-- Reglas 2 y 3 (y la 1 de nuevo). Devuelve { resultado, cliente_id }:
--   confirmado  → regla 1 o alta nueva (regla 3)
--   pendiente   → match por DNI o teléfono (regla 2)
--   conflicto   → el match ya tiene otra cuenta o es ambiguo: no se vincula
--                 (cliente_id = el cliente sugerido para una reserva, si hay)
--   ya_vinculada / personal
-- Nunca modifica un cliente existente (regla 4 / D5).
create or replace function public.fn_cuenta_completar(
  p_user_id uuid, p_email text, p_verificado boolean,
  p_nombre text, p_apellido text, p_telefono text, p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cc clientes_cuentas;
  v_n int;
  v_id uuid;
  v_metodo text;
begin
  perform pg_advisory_xact_lock(hashtextextended('clientes_cuentas:' || p_user_id::text, 0));

  if exists (select 1 from perfiles where user_id = p_user_id) then
    return jsonb_build_object('resultado', 'personal');
  end if;
  select * into v_cc from clientes_cuentas where user_id = p_user_id;
  if found then
    return jsonb_build_object('resultado', 'ya_vinculada', 'cliente_id', v_cc.cliente_id);
  end if;

  -- Regla 1
  if fn_cuenta_vincular_por_email(p_user_id, p_email, p_verificado) then
    select cliente_id into v_id from clientes_cuentas where user_id = p_user_id;
    return jsonb_build_object('resultado', 'confirmado', 'cliente_id', v_id);
  end if;

  -- Regla 2: DNI primero, después teléfono (comparado normalizado: los
  -- teléfonos históricos no están en E.164).
  if coalesce(p_dni, '') <> '' then
    select count(*), (array_agg(id))[1] into v_n, v_id from clientes where dni = p_dni;
    if v_n = 1 then
      v_metodo := 'dni';
    elsif v_n > 1 then
      return jsonb_build_object('resultado', 'conflicto', 'cliente_id', null);
    end if;
  end if;
  if v_metodo is null and coalesce(p_telefono, '') <> '' then
    select count(*), (array_agg(id order by created_at desc))[1] into v_n, v_id
    from clientes
    where telefono = p_telefono or fn_normalizar_telefono_ar(telefono) = p_telefono;
    if v_n = 1 then
      v_metodo := 'telefono';
    elsif v_n > 1 then
      return jsonb_build_object('resultado', 'conflicto', 'cliente_id', v_id);
    end if;
  end if;

  if v_metodo is not null then
    insert into clientes_cuentas (user_id, cliente_id, email, estado, metodo)
    values (p_user_id, v_id, coalesce(p_email, ''), 'pendiente', v_metodo)
    on conflict do nothing;
    if found then
      return jsonb_build_object('resultado', 'pendiente', 'cliente_id', v_id);
    end if;
    return jsonb_build_object('resultado', 'conflicto', 'cliente_id', v_id);
  end if;

  -- Regla 3: cliente nuevo, su propio registro.
  insert into clientes (nombre, apellido, telefono, dni, mail)
  values (p_nombre, p_apellido, p_telefono, nullif(p_dni, ''),
          case when p_verificado then p_email end)
  returning id into v_id;
  insert into clientes_cuentas (user_id, cliente_id, email, estado, metodo)
  values (p_user_id, v_id, coalesce(p_email, ''), 'confirmado', 'alta_web');
  return jsonb_build_object('resultado', 'confirmado', 'cliente_id', v_id);
end;
$$;

-- Lo que ve el cliente. Pendiente = nada del cliente. Confirmado = sus
-- datos básicos, la unidad vinculada y sus reservas web. Nunca DNI, ids,
-- pagos individuales ni comprobantes.
create or replace function public.fn_cuenta_estado(p_user_id uuid, p_email text, p_nombre_google text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cc clientes_cuentas;
  v_cli clientes;
  v_hoy date := public.fn_hoy_ar();
  v_fin date;
  v_unidades jsonb;
  v_reservas jsonb;
begin
  select * into v_cc from clientes_cuentas where user_id = p_user_id;
  if not found then
    return jsonb_build_object('ok', true, 'vinculo', 'ninguno', 'email', p_email, 'nombre_google', p_nombre_google);
  end if;
  if v_cc.estado = 'pendiente' then
    return jsonb_build_object('ok', true, 'vinculo', 'pendiente', 'email', p_email);
  end if;

  select * into v_cli from clientes where id = v_cc.cliente_id;
  select max(fecha_fin) into v_fin from temporadas where estado = 'activa' and fecha_fin >= v_hoy;

  -- Unidad vinculada: reservas activas (titular o cosocio) que incluyen hoy
  -- o son futuras dentro de la temporada activa (temporada incluida).
  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', u.tipo, 'numero', u.numero, 'tipo_alquiler', r.tipo_alquiler,
           'desde', lower(r.rango), 'hasta', upper(r.rango) - 1)
         order by lower(r.rango), u.numero), '[]'::jsonb)
    into v_unidades
  from reservas r
  join unidades u on u.id = r.unidad_id
  where (r.cliente_id = v_cc.cliente_id
         or exists (select 1 from reserva_clientes rc where rc.reserva_id = r.id and rc.cliente_id = v_cc.cliente_id))
    and reserva_activa(r.estado, r.preconfirmada, r.vence_at)
    and r.rango && daterange(v_hoy, v_fin, '[]');

  -- Reservas web del cliente, una por código (mismo criterio de estado que
  -- consultar_reserva_publica).
  select coalesce(jsonb_agg(s.x order by s.desde desc), '[]'::jsonb) into v_reservas
  from (
    select min(lower(r.rango)) as desde,
      jsonb_build_object(
        'codigo', r.codigo,
        'estado', case
          when bool_or(cr.checkin_at is not null) then 'confirmada'
          when bool_and(r.estado = 'cancelada' and r.motivo_cancelacion = 'vencida') then 'vencida'
          when bool_and(r.estado = 'cancelada' and r.motivo_cancelacion is distinct from 'vencida') then 'cancelada'
          when not bool_or(reserva_activa(r.estado, r.preconfirmada, r.vence_at)) then 'vencida'
          else 'preconfirmada' end,
        'unidades', jsonb_agg(jsonb_build_object('tipo', u.tipo, 'numero', u.numero) order by u.numero),
        'desde', min(lower(r.rango)),
        'hasta', max(upper(r.rango) - 1),
        'total', sum(r.valor_total),
        'saldo', sum(r.saldo)) as x
    from reservas r
    join unidades u on u.id = r.unidad_id
    left join codigos_reserva cr on cr.codigo = r.codigo
    where r.cliente_id = v_cc.cliente_id and r.origen = 'web' and r.codigo is not null
    group by r.codigo
    order by min(lower(r.rango)) desc
    limit 20
  ) s;

  return jsonb_build_object(
    'ok', true,
    'vinculo', 'confirmado',
    'email', p_email,
    'cliente', jsonb_build_object(
      'nombre', v_cli.nombre,
      'apellido', v_cli.apellido,
      'telefono', v_cli.telefono,
      'email', nullif(btrim(coalesce(v_cli.mail, '')), ''),
      'dni_cargado', coalesce(btrim(v_cli.dni), '') <> ''),
    'unidades_vigentes', v_unidades,
    'reservas_web', v_reservas);
end;
$$;

-- API para el cliente logueado ------------------------------------------
create or replace function public.mi_cuenta()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt()->>'email', '')));
  v_nombre text := coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'login_requerido');
  end if;
  if exists (select 1 from perfiles where user_id = v_uid) then
    return jsonb_build_object('ok', true, 'vinculo', 'ninguno', 'email', v_email, 'nombre_google', v_nombre);
  end if;
  perform fn_cuenta_vincular_por_email(v_uid, v_email, fn_cuenta_email_verificado(v_uid, v_email));
  return fn_cuenta_estado(v_uid, v_email, v_nombre);
end;
$$;

create or replace function public.completar_cuenta(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt()->>'email', '')));
  v_nombre_google text := coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name');
  v_nombre text := nullif(regexp_replace(btrim(coalesce(p->>'nombre', '')), '\s+', ' ', 'g'), '');
  v_apellido text := nullif(regexp_replace(btrim(coalesce(p->>'apellido', '')), '\s+', ' ', 'g'), '');
  v_telefono text := fn_normalizar_telefono_ar(p->>'telefono_e164');
  v_dni text := nullif(regexp_replace(coalesce(p->>'dni', ''), '\D', '', 'g'), '');
  v_campos jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'login_requerido');
  end if;
  if exists (select 1 from perfiles where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'cuenta_personal',
      'mensaje', 'Esta cuenta es del personal del balneario: no se vincula como cliente.');
  end if;
  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'sin_email');
  end if;
  -- Solo con vínculo 'ninguno'; si ya tiene, devuelve su estado (doble envío).
  if exists (select 1 from clientes_cuentas where user_id = v_uid) then
    return fn_cuenta_estado(v_uid, v_email, v_nombre_google);
  end if;
  -- Nadie prueba DNIs en serie: 10 intentos por hora por cuenta.
  if not consumir_rate_limit('completar_cuenta:' || v_uid::text, 10, 3600) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited',
      'mensaje', 'Demasiados intentos. Esperá un momento y probá de nuevo.');
  end if;

  if v_nombre is null or length(v_nombre) > 80 then v_campos := v_campos || '{"nombre": "Ingresá un nombre válido"}'; end if;
  if v_apellido is null or length(v_apellido) > 80 then v_campos := v_campos || '{"apellido": "Ingresá un apellido válido"}'; end if;
  if v_telefono is null then v_campos := v_campos || '{"telefono_e164": "El teléfono no es válido"}'; end if;
  if v_dni is not null and v_dni !~ '^\d{7,8}$' then v_campos := v_campos || '{"dni": "El DNI no es válido"}'; end if;
  if v_campos <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'error', 'datos_invalidos', 'campos', v_campos);
  end if;

  perform fn_cuenta_completar(v_uid, v_email, fn_cuenta_email_verificado(v_uid, v_email),
                              v_nombre, v_apellido, v_telefono, v_dni);
  return fn_cuenta_estado(v_uid, v_email, v_nombre_google);
end;
$$;

-- Grants: internas solo service_role (y las definer que las llaman).
revoke all on function public.fn_cuenta_email_verificado(uuid, text) from public, anon, authenticated;
revoke all on function public.fn_cuenta_vincular_por_email(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.fn_cuenta_completar(uuid, text, boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function public.fn_cuenta_estado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fn_cuenta_email_verificado(uuid, text) to service_role;
grant execute on function public.fn_cuenta_vincular_por_email(uuid, text, boolean) to service_role;
grant execute on function public.fn_cuenta_completar(uuid, text, boolean, text, text, text, text) to service_role;
grant execute on function public.fn_cuenta_estado(uuid, text, text) to service_role;

revoke all on function public.mi_cuenta() from public, anon;
revoke all on function public.completar_cuenta(jsonb) from public, anon;
grant execute on function public.mi_cuenta() to authenticated;
grant execute on function public.completar_cuenta(jsonb) to authenticated;

-- Fase 6A.1 (pedido de beachFlow): reservas_web de mi_cuenta()/completar_cuenta
-- se filtra SIEMPRE por la cuenta que consulta (codigos_reserva.user_id), nunca
-- por cliente_id.
--   * Una cuenta pendiente que reservó a nombre de un cliente existente ve solo
--     sus reservas; la cuenta confirmada de ese cliente no ve las de la pendiente
--     (y viceversa).
--   * Vínculo 'pendiente': devuelve reservas_web (solo las de esa cuenta), sin
--     ningún dato del cliente existente (ni cliente ni unidades_vigentes).
--   * Vínculo 'ninguno': también devuelve reservas_web de esa cuenta. Es el
--     caso real de "dos cuentas, un cliente": clientes_cuentas tiene UNIQUE
--     (cliente_id), así que si B reserva con el DNI/teléfono de un cliente que
--     ya tiene la cuenta A, fn_cuenta_completar da 'conflicto', B queda sin
--     vínculo y la reserva va igual a ese cliente. Sin esto B no vería su
--     propia reserva y A la vería como suya.
--   * unidades_vigentes sigue solo para vínculo confirmado (por cliente: es la
--     unidad del cliente, no de la cuenta).
-- La firma no cambia: mi_cuenta() y completar_cuenta() la siguen llamando igual.

create or replace function public.fn_cuenta_reservas_web(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  -- Una por código (mismo criterio de estado que consultar_reserva_publica).
  select coalesce(jsonb_agg(s.x order by s.desde desc), '[]'::jsonb)
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
    from codigos_reserva cr
    join reservas r on r.codigo = cr.codigo
    join unidades u on u.id = r.unidad_id
    where p_user_id is not null
      and cr.user_id = p_user_id
      and r.origen = 'web'
    group by r.codigo
    order by min(lower(r.rango)) desc
    limit 20
  ) s;
$$;

revoke all on function public.fn_cuenta_reservas_web(uuid) from public, anon, authenticated;
grant execute on function public.fn_cuenta_reservas_web(uuid) to service_role;

create or replace function public.fn_cuenta_estado(p_user_id uuid, p_email text, p_nombre_google text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cc clientes_cuentas;
  v_cli clientes;
  v_hoy date := public.fn_hoy_ar();
  v_fin date;
  v_unidades jsonb;
begin
  select * into v_cc from clientes_cuentas where user_id = p_user_id;
  if not found then
    return jsonb_build_object('ok', true, 'vinculo', 'ninguno', 'email', p_email, 'nombre_google', p_nombre_google,
      'reservas_web', public.fn_cuenta_reservas_web(p_user_id));
  end if;
  if v_cc.estado = 'pendiente' then
    -- Solo lo que hizo esta cuenta: nada del cliente existente.
    return jsonb_build_object('ok', true, 'vinculo', 'pendiente', 'email', p_email,
      'reservas_web', public.fn_cuenta_reservas_web(p_user_id));
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
    'reservas_web', public.fn_cuenta_reservas_web(p_user_id));
end;
$function$;

revoke all on function public.fn_cuenta_estado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fn_cuenta_estado(uuid, text, text) to service_role;

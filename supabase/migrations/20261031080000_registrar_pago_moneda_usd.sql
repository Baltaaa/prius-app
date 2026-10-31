-- Punto 4, SEGUNDA ETAPA (31/10/2026). Aplicada en producción vía MCP.
--
-- CORRECCIÓN 31/10/2026: este archivo había quedado con un resumen en vez de
-- los cuerpos reales de las funciones, así que el repo NO reproducía
-- producción. Acá va la definición completa, verificada contra
-- pg_get_functiondef() de la base.
--
-- `pagos.monto` sigue siendo el importe EN PESOS que usan saldos, triggers de
-- caja y reportes. `monto_ars` es una columna generada espejo de `monto`, así
-- que NINGÚN trigger cambió. Para ARS el comportamiento es idéntico al
-- anterior; para USD el cliente manda DÓLARES y la multiplicación la hace el
-- servidor.

create or replace function public.fn_cotizacion_vigente()
returns numeric language sql stable security definer set search_path = public as $$
  select case c.lado when 'compra' then tc.compra else tc.venta end
  from public.config_tipo_cambio c
  join public.tipos_cambio tc on tc.tipo = c.tipo
  order by tc.fecha desc limit 1;
$$;

comment on function public.fn_cotizacion_vigente() is
  'Cotización vigente (pesos por dólar) según config_tipo_cambio. La actualiza la Edge Function `tipo-cambio` desde DolarApi.';

create or replace function public.fn_registrar_pago_interno(
  p_reserva_id uuid, p_cliente_id uuid, p_monto numeric, p_medio text,
  p_tipo_pago text, p_concepto text, p_referencia text, p_comprobante jsonb,
  p_permitir_excedente boolean, p_fecha date,
  p_moneda text default 'ARS', p_monto_original numeric default null, p_tipo_cambio numeric default null
)
returns pagos language plpgsql security definer set search_path = public
as $function$
declare
  v_reserva reservas; v_caja_id uuid; v_comprobante_id uuid; v_pago pagos;
  v_pagado numeric; v_fecha date := coalesce(p_fecha, current_date);
  v_moneda text := coalesce(nullif(upper(btrim(p_moneda)), ''), 'ARS');
  v_monto numeric; v_monto_original numeric; v_tc numeric; v_tc_ref numeric;
begin
  if v_moneda not in ('ARS', 'USD') then
    raise exception 'Moneda inválida: %. Solo se aceptan ARS o USD.', v_moneda;
  end if;

  if v_moneda = 'USD' then
    if p_monto_original is null or p_monto_original <= 0 then
      raise exception 'El monto en dólares tiene que ser mayor a 0.';
    end if;
    v_tc_ref := fn_cotizacion_vigente();
    v_tc := coalesce(p_tipo_cambio, v_tc_ref);
    if v_tc is null or v_tc <= 0 then
      raise exception 'No hay cotización del dólar disponible. Actualizala o cargá el tipo de cambio a mano.';
    end if;
    if v_tc_ref is not null and v_tc_ref > 0
       and abs(v_tc - v_tc_ref) / v_tc_ref > 0.30 then
      raise exception 'La cotización ingresada ($%) se aleja más de 30%% de la del día ($%). Revisala.', v_tc, v_tc_ref;
    end if;
    v_monto_original := round(p_monto_original, 2);
    v_monto := round(v_monto_original * v_tc, 2);
  else
    v_monto := p_monto; v_monto_original := null; v_tc := null;
  end if;

  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a 0.';
  end if;

  if p_reserva_id is not null then
    select * into v_reserva from reservas where id = p_reserva_id;
    if not found then raise exception 'La reserva no existe.'; end if;
    if v_reserva.bonificada then
      raise exception 'La reserva está bonificada: no admite pagos.';
    end if;
    select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = p_reserva_id and estado = 'vigente';
    if not p_permitir_excedente and (v_pagado + v_monto) > coalesce(v_reserva.valor_total, 0) then
      raise exception 'El monto supera el saldo de la reserva (saldo actual: %). Confirmá el excedente para continuar.', greatest(coalesce(v_reserva.valor_total,0) - v_pagado, 0)
        using errcode = 'P0002';
    end if;
  end if;

  v_caja_id := fn_resolver_caja_id(v_fecha);

  insert into pagos (
    reserva_id, cliente_id, caja_id, monto, medio, tipo_pago, concepto, referencia,
    comprobante_id, origen, estado, registrado_por, fecha,
    moneda, monto_original, tipo_cambio_usado
  ) values (
    p_reserva_id, p_cliente_id, v_caja_id, v_monto, p_medio, p_tipo_pago, p_concepto, p_referencia,
    null, 'crm', 'vigente', auth.uid(), v_fecha,
    v_moneda, v_monto_original, v_tc
  ) returning * into v_pago;

  if p_comprobante is not null then
    if p_comprobante ? 'comprobante_id' then
      v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
      update comprobantes set pago_id = v_pago.id where id = v_comprobante_id and pago_id is null;
      if not found then
        raise exception 'El comprobante no existe o ya está cargado en otro pago.';
      end if;
    else
      v_comprobante_id := fn_vincular_comprobante(
        p_comprobante->>'tipo', (p_comprobante->>'punto_venta')::integer,
        p_comprobante->>'numero', coalesce((p_comprobante->>'fecha')::date, v_fecha),
        p_cliente_id, v_pago.id
      );
    end if;
    update pagos set comprobante_id = v_comprobante_id where id = v_pago.id returning * into v_pago;
    update comprobantes set monto_total = (
      select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
    ) where id = v_comprobante_id;
  end if;

  if v_caja_id is not null then
    perform fn_recalcula_totales_caja(v_caja_id);
  end if;

  return v_pago;
exception
  when sqlstate 'P0002' or sqlstate 'P0004' then raise;
  when unique_violation then
    raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then
    raise exception 'Los datos del pago o el comprobante no son válidos.';
  when foreign_key_violation then
    raise exception 'El cliente o la reserva asociada no existe.';
end;
$function$;

-- Se borra la versión de 10 args para no dejar overloads ambiguos en
-- PostgREST. Los 4 llamadores (crear_reserva, fn_crear_reserva_con_pago,
-- recepcion_cobrar, registrar_pago) la invocan con 10 argumentos posicionales
-- y pasan a resolver contra la nueva, completando los 3 nuevos con defaults.
drop function if exists public.fn_registrar_pago_interno(
  uuid, uuid, numeric, text, text, text, text, jsonb, boolean, date
);

create or replace function public.registrar_pago(
  p_cliente_id uuid, p_monto numeric, p_medio text, p_tipo_pago text, p_concepto text,
  p_reserva_id uuid, p_referencia text, p_comprobante jsonb, p_permitir_excedente boolean, p_fecha date,
  p_moneda text default 'ARS', p_monto_original numeric default null, p_tipo_cambio numeric default null
)
returns pagos language plpgsql security definer set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  return fn_registrar_pago_interno(
    p_reserva_id, p_cliente_id, p_monto, p_medio, p_tipo_pago, p_concepto, p_referencia,
    p_comprobante, p_permitir_excedente, p_fecha,
    p_moneda, p_monto_original, p_tipo_cambio
  );
end;
$function$;

drop function if exists public.registrar_pago(
  uuid, numeric, text, text, text, uuid, text, jsonb, boolean, date
);

revoke execute on function public.registrar_pago(
  uuid, numeric, text, text, text, uuid, text, jsonb, boolean, date, text, numeric, numeric
) from public, anon;

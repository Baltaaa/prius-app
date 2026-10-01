-- Pagos históricos (comprobantes reales anteriores al inicio de la caja
-- digital, 01/10/2026): deben entrar en `pagos` con su fecha real, actualizar
-- saldo/estado_pago de la reserva como cualquier pago, y aparecer en el
-- historial del cliente/reserva — pero sin generar movimiento en
-- `caja_diaria` ni aparecer en el resumen/cierre de ninguna caja.
--
-- `fn_recalcula_totales_caja`/`resumen_caja` ya filtran estrictamente por
-- `pagos.caja_id = p_caja_id`, así que un pago con `caja_id = null` ya queda
-- afuera de cualquier caja sin tocar esas funciones. Lo único que falta es:
-- 1) que `fn_registrar_pago_interno` no exija una caja abierta cuando el
--    pago es histórico, y deje `caja_id` en null en ese caso;
-- 2) que la fecha del pago sea la fecha real (del comprobante), no
--    `current_date`.

-- 1) Fecha de inicio de la caja digital: una sola fuente de verdad en toda
-- la base (nunca hardcodeada en más de un lugar) — cualquier otra función
-- que necesite este corte debe llamar a esta, no repetir la fecha.
create or replace function public.fn_caja_inicio()
returns date
language sql
immutable
as $function$
  select date '2026-10-01';
$function$;

revoke execute on function public.fn_caja_inicio() from public;
grant execute on function public.fn_caja_inicio() to authenticated;

-- 2) `es_historico` derivado de `pagos.fecha` (columna que ya existía) —
-- generated column: no puede quedar desincronizado de `fecha` a mano, y no
-- hace falta que el frontend ni ninguna RPC lo calculen ni lo escriban.
alter table public.pagos
  add column es_historico boolean generated always as (fecha < public.fn_caja_inicio()) stored;

comment on column public.pagos.es_historico is
  'true si pagos.fecha es anterior al inicio de la caja digital (fn_caja_inicio()) — derivado, nunca se escribe a mano. Un pago histórico no tiene caja_id y no aparece en ningún resumen/cierre de caja.';

-- 3) `fn_registrar_pago_interno` + `registrar_pago`: agregan `p_fecha`
-- (default current_date, compatibilidad con cualquier llamador que no lo
-- mande). Si `p_fecha` es anterior a fn_caja_inicio(), el pago es histórico:
-- no exige caja abierta y se inserta con `caja_id = null`. El resto de la
-- lógica (saldo, bonificada, comprobante) queda igual.
drop function if exists public.fn_registrar_pago_interno(uuid, uuid, numeric, text, text, text, text, jsonb, boolean);
drop function if exists public.registrar_pago(uuid, numeric, text, text, text, uuid, text, jsonb, boolean);

create or replace function public.fn_registrar_pago_interno(
  p_reserva_id uuid,
  p_cliente_id uuid,
  p_monto numeric,
  p_medio text,
  p_tipo_pago text,
  p_concepto text,
  p_referencia text,
  p_comprobante jsonb,
  p_permitir_excedente boolean,
  p_fecha date default current_date
)
returns pagos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
  v_caja_id uuid;
  v_comprobante_id uuid;
  v_pago pagos;
  v_pagado numeric;
  v_cliente_condicion text;
  v_fecha date := coalesce(p_fecha, current_date);
  v_historico boolean := v_fecha < fn_caja_inicio();
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a 0.';
  end if;

  if p_reserva_id is not null then
    select * into v_reserva from reservas where id = p_reserva_id;
    if not found then raise exception 'La reserva no existe.'; end if;
    if v_reserva.bonificada then
      raise exception 'La reserva está bonificada: no admite pagos.';
    end if;
    select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = p_reserva_id and estado = 'vigente';
    if not p_permitir_excedente and (v_pagado + p_monto) > coalesce(v_reserva.valor_total, 0) then
      raise exception 'El monto supera el saldo de la reserva (saldo actual: %). Confirmá el excedente para continuar.', greatest(coalesce(v_reserva.valor_total,0) - v_pagado, 0)
        using errcode = 'P0002';
    end if;
  end if;

  if v_historico then
    -- Pago histórico: nunca pasa por caja, no exige una abierta.
    v_caja_id := null;
  else
    select id into v_caja_id from caja_diaria where estado = 'abierta';
    if v_caja_id is null then
      raise exception 'La caja está cerrada: abrí la caja para registrar el cobro.' using errcode = 'P0003';
    end if;
  end if;

  if p_comprobante is not null then
    if p_comprobante ? 'comprobante_id' then
      v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
    else
      select condicion_iva into v_cliente_condicion from clientes where id = p_cliente_id;
      insert into comprobantes (tipo, punto_venta, numero, fecha, cliente_id, razon_social, cuit, condicion_iva, monto_total)
      select
        p_comprobante->>'tipo',
        (p_comprobante->>'punto_venta')::integer,
        (p_comprobante->>'numero')::integer,
        coalesce((p_comprobante->>'fecha')::date, v_fecha),
        p_cliente_id,
        c.razon_social, c.cuit, coalesce(v_cliente_condicion, 'consumidor_final'), 0
      from clientes c where c.id = p_cliente_id
      returning id into v_comprobante_id;
    end if;
  end if;

  insert into pagos (
    reserva_id, cliente_id, caja_id, monto, medio, tipo_pago, concepto, referencia,
    comprobante_id, origen, estado, registrado_por, fecha
  ) values (
    p_reserva_id, p_cliente_id, v_caja_id, p_monto, p_medio, p_tipo_pago, p_concepto, p_referencia,
    v_comprobante_id, 'crm', 'vigente', auth.uid(), v_fecha
  ) returning * into v_pago;

  if v_comprobante_id is not null then
    update comprobantes set monto_total = (
      select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
    ) where id = v_comprobante_id;
  end if;

  return v_pago;
end;
$function$;

revoke execute on function public.fn_registrar_pago_interno(uuid, uuid, numeric, text, text, text, text, jsonb, boolean, date) from public;

create or replace function public.registrar_pago(
  p_cliente_id uuid,
  p_monto numeric,
  p_medio text,
  p_tipo_pago text,
  p_concepto text,
  p_reserva_id uuid default null,
  p_referencia text default null,
  p_comprobante jsonb default null,
  p_permitir_excedente boolean default false,
  p_fecha date default current_date
)
returns pagos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  return fn_registrar_pago_interno(
    p_reserva_id, p_cliente_id, p_monto, p_medio, p_tipo_pago, p_concepto, p_referencia,
    p_comprobante, p_permitir_excedente, p_fecha
  );
end;
$function$;

revoke execute on function public.registrar_pago(uuid, numeric, text, text, text, uuid, text, jsonb, boolean, date) from public;
revoke execute on function public.registrar_pago(uuid, numeric, text, text, text, uuid, text, jsonb, boolean, date) from anon;
grant execute on function public.registrar_pago(uuid, numeric, text, text, text, uuid, text, jsonb, boolean, date) to authenticated;

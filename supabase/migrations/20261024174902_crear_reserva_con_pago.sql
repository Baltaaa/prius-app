-- Item 3 (oct 2026): alta de reserva + primer pago/comprobante en una sola
-- transacción — si el pago falla, la reserva no queda creada. Extiende
-- fn_registrar_pago_interno (ya probada, usada por registrar_pago) en vez
-- de reimplementar su lógica de saldo/caja/comprobante.
-- Columnas explícitas (no jsonb_populate_record): mismo set que ya manda
-- el front hoy via insert directo — temporada/temporada_id/rango los
-- siguen asignando solos los triggers BEFORE INSERT existentes
-- (fn_reserva_asigna_temporada / fase1_06d_reserva_rango_trigger), no se
-- tocan acá.
create or replace function public.fn_crear_reserva_con_pago(p_reserva jsonb, p_pago jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
  v_pago pagos;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;

  insert into reservas (
    cliente_id, unidad_id, tipo_alquiler, estado, origen,
    fecha_inicio, fecha_fin, fecha, valor_total, bonificada, notas
  ) values (
    (p_reserva->>'cliente_id')::uuid,
    (p_reserva->>'unidad_id')::uuid,
    p_reserva->>'tipo_alquiler',
    coalesce(p_reserva->>'estado', 'activa'),
    coalesce(p_reserva->>'origen', 'manual'),
    (p_reserva->>'fecha_inicio')::date,
    (p_reserva->>'fecha_fin')::date,
    (p_reserva->>'fecha')::date,
    coalesce((p_reserva->>'valor_total')::numeric, 0),
    coalesce((p_reserva->>'bonificada')::boolean, false),
    p_reserva->>'notas'
  ) returning * into v_reserva;

  if p_pago is not null then
    v_pago := fn_registrar_pago_interno(
      v_reserva.id,
      (p_pago->>'cliente_id')::uuid,
      (p_pago->>'monto')::numeric,
      p_pago->>'medio',
      p_pago->>'tipo_pago',
      p_pago->>'concepto',
      p_pago->>'referencia',
      p_pago->'comprobante',
      coalesce((p_pago->>'permitir_excedente')::boolean, false),
      coalesce((p_pago->>'fecha')::date, current_date)
    );
  end if;

  return jsonb_build_object('reserva', to_jsonb(v_reserva), 'pago', to_jsonb(v_pago));
end;
$function$;

revoke all on function public.fn_crear_reserva_con_pago(jsonb, jsonb) from public, anon;
grant execute on function public.fn_crear_reserva_con_pago(jsonb, jsonb) to authenticated;

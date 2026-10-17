-- Cierre retroactivo (oct 2026): el modelo nuevo auto-crea la caja de
-- cualquier fecha al primer cobro/gasto, pero eso dejaba varios días viejos
-- en estado='abierta' sin cerrar nunca (04/10, 09/10, 12/10, 14/10, 15/10).
-- Se cierran todos los días ANTERIORES a hoy con el efectivo esperado como
-- contado (no hay forma de arquear retroactivamente un día pasado) —
-- diferencia 0, marcado explícito en observaciones. Solo la caja de HOY
-- queda abierta de verdad.
do $$
declare
  v_id uuid;
  v_fecha date;
  v_efectivo numeric;
  v_gastos numeric;
  v_esperado numeric;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  for v_id, v_fecha in select id, fecha from caja_diaria where estado = 'abierta' and fecha < v_hoy loop
    select coalesce(sum(monto), 0) into v_efectivo from pagos where caja_id = v_id and estado = 'vigente' and medio = 'efectivo';
    select coalesce(sum(monto), 0) into v_gastos from gastos_caja where caja_id = v_id and estado = 'vigente' and medio_pago = 'efectivo';
    v_esperado := v_efectivo - v_gastos;

    update caja_diaria set
      estado = 'cerrada',
      cerrada_at = (v_fecha + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires',
      efectivo_esperado = v_esperado,
      efectivo_contado = v_esperado,
      diferencia = 0,
      observaciones_cierre = 'Cierre retroactivo automático — migración Fase 4 de Caja (día quedó auto-creado sin cerrar explícitamente). Efectivo contado = esperado por no poder arquear un día pasado.'
    where id = v_id;

    update caja_diaria set resumen_snapshot = resumen_caja(v_id) where id = v_id;

    insert into caja_eventos (caja_id, tipo, detalle, usuario)
    values (v_id, 'cierre', jsonb_build_object('retroactivo', true, 'efectivo_contado', v_esperado, 'diferencia', 0), null);
  end loop;
end $$;

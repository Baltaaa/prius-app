-- Después de borrar el cliente de prueba, el pago en efectivo de $104.000
-- del 12/10 (que era de prueba) desapareció, pero efectivo_esperado/
-- diferencia de esa caja (ya cerrada antes de la limpieza) habían quedado
-- con el valor viejo — total_cobros/total_gastos/total_neto sí se
-- recalculan solos (fn_recalcula_totales_caja), pero esos tres campos del
-- arqueo solo los escribe cerrar_caja. Se resincronizan a mano una vez.
do $$
declare
  v_id uuid;
  v_efectivo numeric;
  v_gastos numeric;
  v_esperado numeric;
begin
  for v_id in select id from caja_diaria where estado = 'cerrada' and fecha >= fn_caja_inicio() loop
    select coalesce(sum(monto), 0) into v_efectivo from pagos where caja_id = v_id and estado = 'vigente' and medio = 'efectivo';
    select coalesce(sum(monto), 0) into v_gastos from gastos_caja where caja_id = v_id and estado = 'vigente' and medio_pago = 'efectivo';
    v_esperado := v_efectivo - v_gastos;
    update caja_diaria set
      efectivo_esperado = v_esperado,
      diferencia = coalesce(efectivo_contado, 0) - v_esperado
    where id = v_id;
    update caja_diaria set resumen_snapshot = resumen_caja(v_id) where id = v_id;
  end loop;
end $$;

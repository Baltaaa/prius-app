-- Limpieza de datos de prueba (Tarea 3.11, oct 2026). Cliente de prueba
-- identificado con certeza (nombre y mail del desarrollador, creado el
-- mismo día que se probó Fase 3 de Caja): "BALTASAR BRUSCHETTI", 4 reservas
-- sobre carpas reales (1, 26, 125, 126) que bloqueaban esas unidades para
-- clientes reales, y 4 pagos de prueba con comprobantes de prueba asociados.

-- 1) Rompe el link pago->comprobante antes de poder borrar los comprobantes.
update pagos set comprobante_id = null
where comprobante_id in ('846e9488-ed39-4b29-a7b9-78bbf1ccaa45', '2c18ba05-8f72-47b6-adde-6c2254350361');

-- 2) Comprobantes de prueba.
delete from comprobantes where id in ('846e9488-ed39-4b29-a7b9-78bbf1ccaa45', '2c18ba05-8f72-47b6-adde-6c2254350361');

-- 3) Reservas de prueba (cascada: borra sus pagos y reserva_clientes).
delete from reservas where cliente_id = 'e8728792-293e-4d46-8923-acc29df365e9';

-- 4) Cliente de prueba.
delete from clientes where id = 'e8728792-293e-4d46-8923-acc29df365e9';

-- Recalcula totales de las cajas que tenían pagos de este cliente.
do $$
declare v_id uuid;
begin
  for v_id in select id from caja_diaria where fecha >= fn_caja_inicio() loop
    perform fn_recalcula_totales_caja(v_id);
  end loop;
end $$;

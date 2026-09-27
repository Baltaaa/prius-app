-- Fix: borrar una reserva con pagos que ya generaron un ingreso de caja
-- tiraba 23503 (ingresos_caja_reserva_id_fkey). El FK reserva_id->reservas
-- estaba en NO ACTION mientras pago_id->pagos ya cascadeaba: al borrar la
-- reserva, el cascade sobre pagos->ingresos_caja (via pago_id) competia con
-- el chequeo directo de este FK sobre la misma fila y lo encontraba violado.
-- Se lo alinea a CASCADE: si se hace hard-delete de una reserva y sus pagos,
-- el movimiento de caja que esos pagos generaron se purga junto con ellos.
alter table public.ingresos_caja
  drop constraint ingresos_caja_reserva_id_fkey,
  add constraint ingresos_caja_reserva_id_fkey
    foreign key (reserva_id) references public.reservas(id) on delete cascade;

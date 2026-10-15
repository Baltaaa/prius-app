-- Bug real (oct 2026): reservas.cliente_id es ON DELETE SET NULL — al borrar
-- un cliente que era titular de una reserva activa, la reserva quedaba
-- "fantasma" (cliente_id null, estado='activa'), siguiendo activando el
-- exclusion constraint de no-solapamiento y mostrando la unidad ocupada en
-- Plano/Ocupación para siempre, sin ningún cliente al que atribuirla ni forma
-- de liberarla desde la UI. Fix: BEFORE DELETE en clientes cancela (soft
-- delete, nunca borra pagos/historial) cualquier reserva activa de la que
-- este cliente sea titular, ANTES de que se ejecute el DELETE real — mismo
-- trigger trg_reserva_actualiza_unidad que ya deriva unidades.estado se
-- encarga de liberar la unidad al ver la reserva en 'cancelada'. Si el DELETE
-- del cliente termina fallando más adelante en la misma sentencia (ej.
-- pagos.cliente_id es NO ACTION y el cliente tiene pagos reales), Postgres
-- revierte toda la sentencia — incluida esta cancelación — así que nunca
-- queda una reserva cancelada "de más" por un borrado que no se completó.
create or replace function fn_cliente_libera_unidad_al_borrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update reservas
  set estado = 'cancelada',
      motivo_cancelacion = 'cliente',
      bloqueada = false
  where cliente_id = old.id
    and estado = 'activa';
  return old;
end;
$$;

drop trigger if exists trg_cliente_libera_unidad_al_borrar on clientes;
create trigger trg_cliente_libera_unidad_al_borrar
  before delete on clientes
  for each row
  execute function fn_cliente_libera_unidad_al_borrar();

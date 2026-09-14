-- Cantidad de cuotas de tarjeta de crédito en las que se cobra el pago al
-- cliente. Distinto de `nro_cuota` (que es el número de instancia de pago
-- sobre el saldo total de la reserva, no las cuotas de la tarjeta). Solo
-- aplica cuando medio = 'tarjeta_credito'; nullable para el resto.
alter table public.pagos
  add column if not exists cuotas_tarjeta integer;

-- Marca como bonificadas las reservas de temporada 2026/2027 de las unidades
-- de cortesía del balneario: Carpa 3 (Chelo, dueño) y Carpa 121 (Patricio
-- Gerbi) — ya estaban bonificada=true de la migración histórica, así que acá
-- son un no-op idempotente. Carpa 70 (Gerardo Gullini) SÍ cambia de estado
-- real: hoy es una reserva de período paga (estado_pago='pendiente', sin
-- pagos registrados todavía) y pasa a bonificada — el trigger
-- fn_reserva_recalcula_saldo la deja en valor_total=0/estado_pago='pagado'
-- automáticamente al tocar la columna bonificada.
update reservas r
set bonificada = true
from unidades u
where r.unidad_id = u.id
  and u.tipo = 'carpa'
  and u.numero in (3, 121, 70)
  and r.temporada = '2026/2027'
  and r.estado = 'activa';

-- Reporte de solo lectura (no modifica nada) — comprobantes huérfanos:
-- filas de `comprobantes` sin `pago_id` Y que ningún `pagos.comprobante_id`
-- referencia tampoco (la relación es redundante a propósito en los dos
-- sentidos desde 20261002130000, así que un huérfano real tiene que
-- fallar ambos lados). Corrida de diagnóstico tras el bug del 409 en
-- completar_comprobante (oct 2026) — no borrar nada acá, cada fila hay que
-- revisarla a mano (vincular al pago correcto o dejarla, nunca un delete
-- masivo).
select
  c.id as comprobante_id,
  fn_comprobante_etiqueta(c) as etiqueta,
  c.tipo,
  c.punto_venta,
  c.numero,
  c.fecha,
  c.cliente_id,
  cl.nombre as cliente_nombre,
  c.monto_total,
  c.created_at
from comprobantes c
left join clientes cl on cl.id = c.cliente_id
where c.pago_id is null
  and not exists (select 1 from pagos p where p.comprobante_id = c.id)
order by c.created_at desc;

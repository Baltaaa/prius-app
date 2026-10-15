-- Oct 2026: regla única de estado de pago (SIN PAGO / PAGO PARCIAL / PAGADO).
-- Bug real: sum(monto) trataba un pago con monto null (recibo migrado sin
-- importe legible) como si fuera $0 pagado, así que una reserva con 2
-- recibos sin monto (Sara Azcárate, RB-1138/RB-1868) quedaba en "pendiente"
-- (SIN PAGO) en vez de "parcial" (PAGO PARCIAL + aviso). Un "pago real" es
-- uno que tiene monto cargado O un comprobante vigente vinculado — una fila
-- de pagos vacía del import (sin monto Y sin comprobante, 9 casos detectados,
-- ej. Natalia Duhalde) es un artefacto de la migración, no un pago: no
-- cuenta para nada acá (se resuelve aparte, ver fn_notif_upsert_sin_precio).
create or replace function fn_pago_es_real(p_pago_id uuid, p_monto numeric)
returns boolean
language sql stable
set search_path = public
as $$
  select p_monto is not null or exists (
    select 1 from comprobantes c where c.pago_id = p_pago_id and c.estado <> 'anulado'
  )
$$;

revoke all on function fn_pago_es_real(uuid, numeric) from public;
grant execute on function fn_pago_es_real(uuid, numeric) to authenticated;

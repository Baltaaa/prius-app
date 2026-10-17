-- La caja del 12/10 fue cerrada retroactivamente por el sistema (no por un
-- arqueo real del admin) con contado=esperado como placeholder; al borrar
-- el pago de prueba de $104.000 el esperado bajó a $0, pero el contado
-- seguía en $104.000 (dejaba una "diferencia" falsa). Solo se corrige esta
-- caja — 01/10 y 08/10 son cierres reales del admin, no se tocan.
update caja_diaria set efectivo_contado = 0, diferencia = 0
where fecha = '2026-10-12';
update caja_diaria set resumen_snapshot = resumen_caja(id) where fecha = '2026-10-12';

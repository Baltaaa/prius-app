-- Desde oct 2026 cada día abre su propia caja sola (auto-creada por fecha);
-- varias pueden quedar 'abierta' (= sin cerrar/arquear) simultáneamente —
-- ya no hay "la" caja abierta única. Este índice pertenecía al modelo
-- viejo de una sola caja activa por vez.
drop index if exists idx_caja_diaria_una_abierta;

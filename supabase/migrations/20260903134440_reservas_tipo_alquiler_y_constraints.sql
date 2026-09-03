-- Tarea 2 — Migración de schema para el plano interactivo funcional.
-- El seed de 184 unidades (144 carpa + 40 sombrilla) ya existía en la DB al aplicar
-- esta migración, por eso acá solo va la unicidad tipo+numero y los campos de reservas.

ALTER TABLE unidades ADD CONSTRAINT unidades_tipo_numero_key UNIQUE (tipo, numero);

-- unidades.estado: SIN CAMBIOS. Se mantiene el CHECK existente (libre | ocupada | reservada),
-- default 'libre'. Campo derivado: lo escribe el trigger de la migración siguiente,
-- nunca se edita a mano desde el CRM.

ALTER TABLE reservas ADD COLUMN tipo_alquiler text
  CHECK (tipo_alquiler IN ('temporada','periodo','dia'));

-- Solo para tipo_alquiler = 'dia' (una sola jornada; no tiene sentido fecha_inicio/fecha_fin).
ALTER TABLE reservas ADD COLUMN fecha date;

-- Vigencia del contrato de la reserva. Necesario para que el trigger sepa liberar la unidad
-- cuando una reserva se cancela.
ALTER TABLE reservas ADD COLUMN estado text NOT NULL DEFAULT 'activa'
  CHECK (estado IN ('activa','cancelada'));

ALTER TABLE reservas ADD CONSTRAINT reservas_fechas_por_tipo CHECK (
  tipo_alquiler IS NULL
  OR (tipo_alquiler = 'dia' AND fecha IS NOT NULL)
  OR (tipo_alquiler IN ('temporada','periodo') AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL)
);

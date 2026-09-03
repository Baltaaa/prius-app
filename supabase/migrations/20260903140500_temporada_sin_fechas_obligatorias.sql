-- Ajuste a Tareas 2 y 3: la "temporada" es temporada completa (arranca ~octubre,
-- termina ~1a quincena de abril). No lleva fechas obligatorias; si se cargan, acotan.

ALTER TABLE reservas DROP CONSTRAINT reservas_fechas_por_tipo;
ALTER TABLE reservas ADD CONSTRAINT reservas_fechas_por_tipo CHECK (
  tipo_alquiler IS NULL
  OR tipo_alquiler = 'temporada'
  OR (tipo_alquiler = 'dia' AND fecha IS NOT NULL)
  OR (tipo_alquiler = 'periodo' AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL)
);

-- Vigencia por tipo. Temporada sin fechas => vigente mientras esté activa.
CREATE OR REPLACE FUNCTION fn_reserva_vigente(r reservas)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT r.estado = 'activa' AND CASE r.tipo_alquiler
    WHEN 'dia' THEN r.fecha = CURRENT_DATE
    WHEN 'periodo' THEN CURRENT_DATE BETWEEN r.fecha_inicio AND r.fecha_fin
    WHEN 'temporada' THEN (r.fecha_inicio IS NULL OR r.fecha_inicio <= CURRENT_DATE)
                      AND (r.fecha_fin    IS NULL OR CURRENT_DATE <= r.fecha_fin)
    ELSE false
  END;
$$;
ALTER FUNCTION fn_reserva_vigente(reservas) SET search_path = public, pg_temp;

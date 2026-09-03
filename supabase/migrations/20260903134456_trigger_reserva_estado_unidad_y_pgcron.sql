-- Tarea 3 — El plano nunca recibe un estado tipeado a mano: reacciona vía trigger
-- Postgres a INSERT/UPDATE/DELETE en `reservas`. Patrón single-write / multiple reactive reads.

-- Una reserva está vigente si está activa y hoy cae dentro de su rango (o su fecha, para 'dia').
CREATE OR REPLACE FUNCTION fn_reserva_vigente(r reservas)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT r.estado = 'activa' AND (
    (r.tipo_alquiler = 'dia' AND r.fecha = CURRENT_DATE) OR
    (r.tipo_alquiler IN ('temporada','periodo') AND CURRENT_DATE BETWEEN r.fecha_inicio AND r.fecha_fin)
  );
$$;
ALTER FUNCTION fn_reserva_vigente(reservas) SET search_path = public, pg_temp;

-- Trigger: recalcula unidades.estado de la(s) unidad(es) afectada(s) por el cambio en reservas.
-- Nunca pisa 'reservada' (hold manual / preconfirmada).
CREATE OR REPLACE FUNCTION fn_reserva_actualiza_unidad()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u_ids uuid[];
BEGIN
  u_ids := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[NEW.unidad_id, OLD.unidad_id]) x WHERE x IS NOT NULL);
  UPDATE unidades u SET estado = CASE
    WHEN EXISTS (SELECT 1 FROM reservas r WHERE r.unidad_id = u.id AND fn_reserva_vigente(r))
      THEN 'ocupada' ELSE 'libre' END
  WHERE u.id = ANY(u_ids)
    AND u.estado <> 'reservada'
    AND u.estado IS DISTINCT FROM (CASE
      WHEN EXISTS (SELECT 1 FROM reservas r WHERE r.unidad_id = u.id AND fn_reserva_vigente(r))
        THEN 'ocupada' ELSE 'libre' END);
  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION fn_reserva_actualiza_unidad() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_reserva_actualiza_unidad ON reservas;
CREATE TRIGGER trg_reserva_actualiza_unidad
AFTER INSERT OR UPDATE OR DELETE ON reservas
FOR EACH ROW EXECUTE FUNCTION fn_reserva_actualiza_unidad();

-- Recálculo masivo. Resuelve el punto abierto: una reserva 'periodo'/'dia' vence en fecha
-- futura sin que se dispare ningún INSERT/UPDATE ese día. pg_cron corre esto todos los días
-- para que el plano quede al día aunque nadie escriba nada.
CREATE OR REPLACE FUNCTION fn_recalcular_estados_unidades()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE unidades u SET estado = nuevo.estado
  FROM (
    SELECT u2.id, CASE
      WHEN EXISTS (SELECT 1 FROM reservas r WHERE r.unidad_id = u2.id AND fn_reserva_vigente(r))
        THEN 'ocupada' ELSE 'libre' END AS estado
    FROM unidades u2 WHERE u2.estado <> 'reservada'
  ) nuevo
  WHERE u.id = nuevo.id AND u.estado IS DISTINCT FROM nuevo.estado;
END;
$$;
ALTER FUNCTION fn_recalcular_estados_unidades() SET search_path = public, pg_temp;

CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 03:05 UTC = 00:05 ART
SELECT cron.schedule('recalcular-estados-unidades', '5 3 * * *',
  'SELECT fn_recalcular_estados_unidades()');

-- Realtime para el plano.
ALTER PUBLICATION supabase_realtime ADD TABLE unidades;
ALTER PUBLICATION supabase_realtime ADD TABLE reservas;

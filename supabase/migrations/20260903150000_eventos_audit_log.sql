-- Línea de tiempo del CRM: log de auditoría escrito por triggers. Cada acción
-- sobre reservas / pagos / clientes / unidades / gastos_caja queda registrada
-- con su fecha de negocio (fecha_ref) para poder ordenarla "respetando fechas".

CREATE TABLE eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts           timestamptz NOT NULL DEFAULT now(),
  tabla        text NOT NULL,
  operacion    text NOT NULL CHECK (operacion IN ('INSERT','UPDATE','DELETE')),
  registro_id  uuid,
  descripcion  text NOT NULL,
  fecha_ref    date NOT NULL,
  datos        jsonb
);
CREATE INDEX eventos_fecha_ref_idx ON eventos (fecha_ref DESC, ts DESC);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select_eventos ON eventos FOR SELECT TO authenticated USING (true);
-- Sin políticas de INSERT/UPDATE/DELETE: solo escribe el trigger (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION fn_log_evento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_rec   record;
  v_desc  text;
  v_fecha date;
BEGIN
  IF TG_OP = 'DELETE' THEN v_rec := OLD; ELSE v_rec := NEW; END IF;

  IF TG_TABLE_NAME = 'reservas' THEN
    v_fecha := COALESCE(v_rec.fecha, v_rec.fecha_inicio, CURRENT_DATE);
    v_desc  := format('Reserva %s — %s', lower(TG_OP), COALESCE(v_rec.tipo_alquiler, 's/tipo'));
  ELSIF TG_TABLE_NAME = 'pagos' THEN
    v_fecha := COALESCE(v_rec.fecha, CURRENT_DATE);
    v_desc  := format('Pago %s — $%s %s', lower(TG_OP), v_rec.monto, COALESCE(v_rec.medio, ''));
  ELSIF TG_TABLE_NAME = 'clientes' THEN
    v_fecha := COALESCE(v_rec.created_at::date, CURRENT_DATE);
    v_desc  := format('Cliente %s — %s', lower(TG_OP), v_rec.nombre);
  ELSIF TG_TABLE_NAME = 'unidades' THEN
    IF TG_OP = 'UPDATE' AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NULL; END IF;
    v_fecha := CURRENT_DATE;
    v_desc  := format('Unidad %s #%s → %s', v_rec.tipo, v_rec.numero, v_rec.estado);
  ELSIF TG_TABLE_NAME = 'gastos_caja' THEN
    v_fecha := CURRENT_DATE;
    v_desc  := format('Gasto %s — $%s %s', lower(TG_OP), v_rec.monto, COALESCE(v_rec.descripcion, ''));
  ELSE
    v_fecha := CURRENT_DATE;
    v_desc  := format('%s %s', TG_TABLE_NAME, lower(TG_OP));
  END IF;

  INSERT INTO eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos)
  VALUES (TG_TABLE_NAME, TG_OP, v_rec.id, v_desc, v_fecha, to_jsonb(v_rec));
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_zzz_log_evento AFTER INSERT OR UPDATE OR DELETE ON reservas
  FOR EACH ROW EXECUTE FUNCTION fn_log_evento();
CREATE TRIGGER trg_zzz_log_evento AFTER INSERT OR UPDATE OR DELETE ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_log_evento();
CREATE TRIGGER trg_zzz_log_evento AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_log_evento();
CREATE TRIGGER trg_zzz_log_evento AFTER INSERT OR UPDATE OR DELETE ON unidades
  FOR EACH ROW EXECUTE FUNCTION fn_log_evento();
CREATE TRIGGER trg_zzz_log_evento AFTER INSERT OR UPDATE OR DELETE ON gastos_caja
  FOR EACH ROW EXECUTE FUNCTION fn_log_evento();

ALTER PUBLICATION supabase_realtime ADD TABLE eventos;

-- Es una función de trigger, no una RPC: que no sea invocable desde la API.
REVOKE EXECUTE ON FUNCTION fn_log_evento() FROM public, anon, authenticated;

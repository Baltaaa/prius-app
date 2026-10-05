-- Historial unificado (ítems 2 y 4 del masterprompt de UI/UX, oct 2026): el
-- log de eventos ya existía (20260903150000_eventos_audit_log.sql) pero no
-- registraba comprobantes, no guardaba quién hizo el cambio ni el valor
-- anterior en un UPDATE, y no distinguía tipos de evento más finos que
-- tabla+operación — necesario para filtrar "cambios de unidad", "notas",
-- "anulaciones" y "comprobante editado" en la UI de Historial sin adivinar
-- a partir de texto libre.

alter table eventos add column usuario uuid references auth.users(id);
alter table eventos add column tipo_evento text;

create index eventos_datos_gin on eventos using gin (datos);
create index eventos_tipo_evento_idx on eventos (tipo_evento);

create or replace function fn_log_evento()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new   jsonb;
  v_old   jsonb;
  v_fecha date;
  v_desc  text;
  v_tipo  text;
  v_id    uuid;
begin
  -- CASE evalúa solo la rama elegida (lazy) — evita tocar NEW en un DELETE o
  -- OLD en un INSERT, que en PL/pgSQL explota con "record is not assigned".
  v_new := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end;
  v_old := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end;
  v_id  := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);

  if TG_TABLE_NAME = 'reservas' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_new->>'fecha_inicio')::date, (v_old->>'fecha')::date, (v_old->>'fecha_inicio')::date, current_date);
    if TG_OP = 'INSERT' then
      v_tipo := 'reserva_alta'; v_desc := format('Reserva nueva — %s', coalesce(v_new->>'tipo_alquiler', 's/tipo'));
    elsif TG_OP = 'DELETE' then
      v_tipo := 'reserva_eliminada'; v_desc := 'Reserva eliminada';
    elsif v_new->>'estado' = 'cancelada' and v_old->>'estado' is distinct from v_new->>'estado' then
      v_tipo := 'reserva_cancelada'; v_desc := 'Reserva cancelada';
    elsif v_old->>'unidad_id' is distinct from v_new->>'unidad_id' then
      v_tipo := 'cambio_unidad'; v_desc := 'Cambio de unidad';
    elsif v_old->>'notas' is distinct from v_new->>'notas' then
      v_tipo := 'nota'; v_desc := 'Nota actualizada';
    else
      v_tipo := 'reserva_editada'; v_desc := 'Reserva editada';
    end if;

  elsif TG_TABLE_NAME = 'pagos' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_old->>'fecha')::date, current_date);
    if TG_OP = 'INSERT' then
      v_tipo := 'pago'; v_desc := format('Pago registrado — $%s %s', v_new->>'monto', coalesce(v_new->>'medio', ''));
    elsif TG_OP = 'DELETE' then
      v_tipo := 'pago_eliminado'; v_desc := 'Pago eliminado';
    elsif v_old->>'estado' is distinct from v_new->>'estado' and v_new->>'estado' = 'anulado' then
      v_tipo := 'anulacion'; v_desc := format('Pago anulado — $%s', v_old->>'monto');
    else
      v_tipo := 'pago_editado'; v_desc := format('Pago editado — $%s', v_new->>'monto');
    end if;

  elsif TG_TABLE_NAME = 'comprobantes' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_old->>'fecha')::date, current_date);
    if TG_OP = 'INSERT' then
      v_tipo := 'comprobante'; v_desc := format('Comprobante cargado — %s %s', v_new->>'tipo', v_new->>'numero');
    elsif TG_OP = 'DELETE' then
      v_tipo := 'comprobante_eliminado'; v_desc := 'Comprobante eliminado';
    else
      v_tipo := 'comprobante_editado'; v_desc := format('Comprobante editado — %s %s', v_new->>'tipo', v_new->>'numero');
    end if;

  elsif TG_TABLE_NAME = 'clientes' then
    v_fecha := coalesce(((v_new->>'created_at')::timestamptz)::date, ((v_old->>'created_at')::timestamptz)::date, current_date);
    if TG_OP = 'INSERT' then
      v_tipo := 'cliente_alta'; v_desc := format('Cliente nuevo — %s', v_new->>'nombre');
    elsif TG_OP = 'DELETE' then
      v_tipo := 'cliente_eliminado'; v_desc := format('Cliente eliminado — %s', v_old->>'nombre');
    else
      v_tipo := 'cliente_editado'; v_desc := format('Cliente editado — %s', v_new->>'nombre');
    end if;

  elsif TG_TABLE_NAME = 'unidades' then
    if TG_OP = 'UPDATE' and v_new->>'estado' is not distinct from v_old->>'estado' then
      return null;
    end if;
    v_fecha := current_date;
    v_tipo := 'unidad_estado';
    v_desc := format('Unidad %s #%s → %s', v_new->>'tipo', v_new->>'numero', v_new->>'estado');

  elsif TG_TABLE_NAME = 'gastos_caja' then
    v_fecha := current_date;
    if TG_OP = 'INSERT' then
      v_tipo := 'gasto'; v_desc := format('Gasto registrado — $%s %s', v_new->>'monto', coalesce(v_new->>'descripcion', ''));
    elsif v_old->>'estado' is distinct from v_new->>'estado' and v_new->>'estado' = 'anulado' then
      v_tipo := 'gasto_anulado'; v_desc := format('Gasto anulado — $%s', v_old->>'monto');
    else
      v_tipo := 'gasto_editado'; v_desc := format('Gasto editado — $%s', v_new->>'monto');
    end if;

  else
    v_fecha := current_date;
    v_tipo := lower(TG_TABLE_NAME || '_' || TG_OP);
    v_desc := format('%s %s', TG_TABLE_NAME, lower(TG_OP));
  end if;

  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento)
  values (
    TG_TABLE_NAME, TG_OP, v_id, v_desc, v_fecha,
    jsonb_strip_nulls(jsonb_build_object('before', v_old, 'after', v_new)),
    auth.uid(), v_tipo
  );
  return null;
end;
$$;

create trigger trg_zzz_log_evento after insert or update or delete on comprobantes
  for each row execute function fn_log_evento();

revoke execute on function fn_log_evento() from public, anon, authenticated;

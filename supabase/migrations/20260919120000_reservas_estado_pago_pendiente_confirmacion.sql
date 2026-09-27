-- Restaura "pendiente_confirmacion" como estado_pago propio: clientes fijos
-- de la temporada pasada que todavía no confirmaron ni pagaron nada para la
-- temporada actual (temporada 2026/2027). Se había colapsado en "pendiente"
-- genérico en algún momento de la migración histórica original, sin quedar
-- documentado — ver auditoría sep 2026 / caso Adriana Aguero, Sombrilla #11.
--
-- El criterio de backfill (tipo_alquiler=temporada, estado=activa,
-- valor_total=0, estado_pago=pendiente) fue verificado dato a dato contra la
-- hoja TEMPORADA del excel original de la migración (color de fondo blanco =
-- pendiente_confirmacion): da exactamente las mismas 72 unidades (57 carpas +
-- 15 sombrillas), 0 diferencias en ambos sentidos. El chequeo de abajo aborta
-- la migración si ese número cambiara respecto de lo verificado.

alter table reservas drop constraint reservas_estado_pago_check;
alter table reservas add constraint reservas_estado_pago_check
  check (estado_pago = any (array['pendiente', 'parcial', 'pagado', 'pendiente_confirmacion']));

do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from reservas
  where tipo_alquiler = 'temporada'
    and estado = 'activa'
    and valor_total = 0
    and estado_pago = 'pendiente';

  if v_count <> 72 then
    raise exception 'Se esperaban exactamente 72 reservas para migrar a pendiente_confirmacion, se encontraron %. Migración abortada — revisar el criterio antes de reintentar.', v_count;
  end if;

  -- No toca la columna valor_total, así que fn_reserva_recalcula_saldo
  -- (BEFORE UPDATE OF valor_total) no se dispara y no pisa este UPDATE.
  update reservas
  set estado_pago = 'pendiente_confirmacion'
  where tipo_alquiler = 'temporada'
    and estado = 'activa'
    and valor_total = 0
    and estado_pago = 'pendiente';
end $$;

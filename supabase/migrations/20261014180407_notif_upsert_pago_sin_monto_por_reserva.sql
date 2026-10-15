-- Reemplaza la notificación "pago_sin_monto" por-pago (duplicaba una fila
-- por recibo: Sara/Florencia/Nati/Ivana aparecían repetidas) por una sola
-- fila por RESERVA, con el conteo de recibos sin monto en el título mismo
-- — se re-emite (UPDATE, no DO NOTHING) cada vez que ese conteo cambia, así
-- el título nunca queda desactualizado. Ignora pagos "fantasma" del import
-- (sin monto y sin comprobante, ver fn_pago_es_real) — esa es la causa real
-- del caso Natalia Duhalde, que hoy dispara este aviso sin tener ningún
-- pago real.
create or replace function fn_notif_upsert_pago_sin_monto(p_reserva_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_cliente_id uuid;
  v_cliente_nombre text;
  v_ruta text;
begin
  select count(*) into v_count
  from pagos p
  where p.reserva_id = p_reserva_id
    and p.estado = 'vigente'
    and p.monto is null
    and exists (select 1 from comprobantes c where c.pago_id = p.id and c.estado <> 'anulado');

  if v_count = 0 then
    perform fn_notif_resolver(p_reserva_id, 'pago_sin_monto');
    return;
  end if;

  select r.cliente_id, nullif(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, '')), '')
    into v_cliente_id, v_cliente_nombre
    from reservas r join clientes c on c.id = r.cliente_id
    where r.id = p_reserva_id;

  v_ruta := format('/app/clientes?id=%s&reserva=%s&accion=cargar_recibos', v_cliente_id, p_reserva_id);

  insert into notificaciones (categoria, tipo, titulo, detalle, entidad_tipo, entidad_id, ruta_destino, actor_id)
  values (
    'pendiente', 'pago_sin_monto',
    format('Recibos sin monto asignado (%s)', v_count),
    coalesce(v_cliente_nombre, 'Cliente s/n'),
    'reserva', p_reserva_id, v_ruta, null
  )
  on conflict (entidad_id, tipo) where (categoria = 'pendiente' and resuelta_at is null)
  do update set titulo = excluded.titulo, detalle = excluded.detalle;
end;
$$;

revoke all on function fn_notif_upsert_pago_sin_monto(uuid) from public;
grant execute on function fn_notif_upsert_pago_sin_monto(uuid) to authenticated;

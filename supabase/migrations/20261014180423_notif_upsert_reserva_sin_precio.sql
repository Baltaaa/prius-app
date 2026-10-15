-- Nuevo tipo de pendiente: "Asignar monto total de unidad" — reserva real
-- (no bonificada, no pendiente_confirmacion) sin precio cargado (valor_total
-- <= 0, mismo criterio que ya usa PagosGrid.jsx) y sin ningún pago real
-- (ver fn_pago_es_real). Caso Natalia Duhalde: valor_total=0 y su único
-- "pago" es una fila fantasma del import (sin monto, sin comprobante) — no
-- cuenta como pago real, así que cae acá en vez de en "pago_sin_monto".
--
-- NOTA: esta versión no contempla reservas con precio unificado (grupo_id)
-- — corregido en la migración fix_notif_sin_precio_excluye_grupos.
create or replace function fn_notif_upsert_sin_precio(p_reserva_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva reservas%rowtype;
  v_tiene_pago_real boolean;
  v_cliente_nombre text;
  v_unidad_label text;
  v_ruta text;
begin
  select * into v_reserva from reservas where id = p_reserva_id;
  if not found or v_reserva.estado = 'cancelada' or v_reserva.bonificada
     or v_reserva.estado_pago = 'pendiente_confirmacion' then
    perform fn_notif_resolver(p_reserva_id, 'reserva_sin_precio');
    return;
  end if;

  select exists (
    select 1 from pagos p
    where p.reserva_id = p_reserva_id and p.estado = 'vigente'
      and fn_pago_es_real(p.id, p.monto)
  ) into v_tiene_pago_real;

  if coalesce(v_reserva.valor_total, 0) > 0 or v_tiene_pago_real then
    perform fn_notif_resolver(p_reserva_id, 'reserva_sin_precio');
    return;
  end if;

  select nullif(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, '')), '')
    into v_cliente_nombre from clientes c where c.id = v_reserva.cliente_id;
  if v_reserva.unidad_id is not null then
    select format('%s %s', initcap(u.tipo), u.numero) into v_unidad_label
    from unidades u where u.id = v_reserva.unidad_id;
  end if;

  v_ruta := format('/app/clientes?id=%s&reserva=%s&accion=asignar_precio', v_reserva.cliente_id, p_reserva_id);

  insert into notificaciones (categoria, tipo, titulo, detalle, entidad_tipo, entidad_id, ruta_destino, actor_id)
  values (
    'pendiente', 'reserva_sin_precio',
    format('Asignar monto total de unidad — %s', coalesce(v_cliente_nombre, 'Cliente s/n')),
    v_unidad_label,
    'reserva', p_reserva_id, v_ruta, null
  )
  on conflict (entidad_id, tipo) where (categoria = 'pendiente' and resuelta_at is null)
  do update set titulo = excluded.titulo, detalle = excluded.detalle;
end;
$$;

revoke all on function fn_notif_upsert_sin_precio(uuid) from public;
grant execute on function fn_notif_upsert_sin_precio(uuid) to authenticated;

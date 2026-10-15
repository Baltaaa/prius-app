create or replace function fn_notif_reservas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_nombre text;
  v_cliente_nombre text;
  v_unidad_label text;
  v_tipo text;
  v_titulo text;
  v_id uuid := coalesce(NEW.id, OLD.id);
  v_ruta text;
begin
  select nombre into v_actor_nombre from perfiles where user_id = v_actor;
  select nullif(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, '')), '')
    into v_cliente_nombre from clientes c where c.id = coalesce(NEW.cliente_id, OLD.cliente_id);
  if coalesce(NEW.unidad_id, OLD.unidad_id) is not null then
    select format('%s %s', initcap(u.tipo), u.numero) into v_unidad_label
    from unidades u where u.id = coalesce(NEW.unidad_id, OLD.unidad_id);
  end if;
  v_ruta := format('/app/reservas?id=%s', v_id);

  -- oct 2026: "Asignar monto total de unidad" — se chequea en cada
  -- insert/update de la reserva (precio recién cargado, o reserva nueva sin
  -- precio todavía), independiente de las novedades de abajo.
  perform fn_notif_upsert_sin_precio(v_id);

  if TG_OP = 'UPDATE' then
    if OLD.estado <> 'cancelada' and NEW.estado = 'cancelada' then
      perform fn_notif_resolver(NEW.id, 'saldo_pendiente_checkin');
    end if;
    if OLD.estado_pago is distinct from NEW.estado_pago and NEW.estado_pago = 'pagado' then
      perform fn_notif_resolver(NEW.id, 'saldo_pendiente_checkin');
    end if;
  end if;

  if TG_OP = 'INSERT' then
    v_tipo := 'reserva_creada';
    v_titulo := format('%s creó una reserva', coalesce(v_actor_nombre, 'Sistema'));
  elsif TG_OP = 'UPDATE' and OLD.estado <> 'cancelada' and NEW.estado = 'cancelada' then
    v_tipo := 'reserva_cancelada';
    v_titulo := format('%s canceló una reserva', coalesce(v_actor_nombre, 'Sistema'));
  elsif TG_OP = 'UPDATE' and (
      OLD.fecha_inicio is distinct from NEW.fecha_inicio or OLD.fecha_fin is distinct from NEW.fecha_fin or
      OLD.fecha is distinct from NEW.fecha or OLD.unidad_id is distinct from NEW.unidad_id or
      OLD.valor_total is distinct from NEW.valor_total
    ) then
    v_tipo := 'reserva_modificada';
    v_titulo := format('%s modificó una reserva', coalesce(v_actor_nombre, 'Sistema'));
  else
    return null;
  end if;

  perform fn_notif_crear(
    'novedad', v_tipo, v_titulo,
    nullif(trim(both ' · ' from concat_ws(' · ', v_unidad_label, v_cliente_nombre)), ''),
    'reserva', v_id, v_ruta, v_actor,
    v_tipo || ':' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')
  );

  return null;
end;
$$;

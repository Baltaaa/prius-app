create or replace function fn_notif_pagos()
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
  v_reserva reservas%rowtype;
  v_ruta text;
begin
  select nombre into v_actor_nombre from perfiles where user_id = v_actor;
  select nullif(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, '')), '')
    into v_cliente_nombre from clientes c where c.id = coalesce(NEW.cliente_id, OLD.cliente_id);
  v_ruta := format('/app/clientes?id=%s&pago=%s', coalesce(NEW.cliente_id, OLD.cliente_id), coalesce(NEW.id, OLD.id));

  if TG_OP = 'INSERT' then
    if NEW.reserva_id is not null then
      perform fn_notif_upsert_pago_sin_monto(NEW.reserva_id);
      perform fn_notif_upsert_sin_precio(NEW.reserva_id);
    end if;

    if NEW.comprobante_id is not null and NEW.reserva_id is null and NEW.estado = 'vigente' then
      perform fn_notif_crear(
        'pendiente', 'comprobante_sin_vincular',
        format('Comprobante sin vincular — %s', coalesce(v_cliente_nombre, 'Cliente s/n')),
        'Pago con comprobante cargado pero sin reserva asociada',
        'pago', NEW.id, v_ruta, v_actor, null
      );
    end if;

    if NEW.monto is not null and NEW.estado = 'vigente' then
      if NEW.reserva_id is not null then
        select * into v_reserva from reservas where id = NEW.reserva_id;
        if v_reserva.unidad_id is not null then
          select format('%s %s', initcap(u.tipo), u.numero) into v_unidad_label
          from unidades u where u.id = v_reserva.unidad_id;
        end if;
      end if;
      perform fn_notif_crear(
        'novedad', 'pago_registrado',
        format('%s registró un pago', coalesce(v_actor_nombre, 'Sistema')),
        nullif(trim(both ' · ' from concat_ws(' · ', v_unidad_label, v_cliente_nombre)), ''),
        'pago', NEW.id, v_ruta, v_actor,
        'pago_registrado:' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')
      );
    end if;

  elsif TG_OP = 'UPDATE' then
    if NEW.reserva_id is not null and OLD.reserva_id is distinct from NEW.reserva_id then
      perform fn_notif_resolver(NEW.id, 'comprobante_sin_vincular');
    end if;
    if coalesce(NEW.reserva_id, OLD.reserva_id) is not null and (
      OLD.monto is distinct from NEW.monto or OLD.estado is distinct from NEW.estado
      or OLD.comprobante_id is distinct from NEW.comprobante_id
    ) then
      perform fn_notif_upsert_pago_sin_monto(coalesce(NEW.reserva_id, OLD.reserva_id));
      perform fn_notif_upsert_sin_precio(coalesce(NEW.reserva_id, OLD.reserva_id));
    end if;
    if OLD.estado is distinct from NEW.estado and NEW.estado = 'anulado' then
      perform fn_notif_resolver(NEW.id, 'comprobante_sin_vincular');
    end if;
  end if;

  return null;
end;
$$;

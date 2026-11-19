-- Fase 5A, Tarea 5: crear_reserva_publica exige la cuenta del cliente.
alter table public.codigos_reserva add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists codigos_reserva_user_id_idx on public.codigos_reserva (user_id) where user_id is not null;

drop function if exists public.crear_reserva_publica(jsonb);

CREATE OR REPLACE FUNCTION public.crear_reserva_publica(p jsonb, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_config config_reservas_publicas;
  v_tipo_alquiler text := p->>'tipo_alquiler';
  v_desde date := (p->>'desde')::date;
  v_hasta date := (p->>'hasta')::date;
  v_personas int := (p->>'cantidad_personas')::int;
  v_tipo_unidad text := p->>'tipo_unidad';
  v_unidad_ids uuid[];
  v_metodo text := p->>'metodo_pago';
  v_cliente jsonb := p->'cliente';
  v_lead_id uuid := case when p->>'lead_id' is null then null else (p->>'lead_id')::uuid end;

  v_hoy date;
  v_ahora_art timestamptz;
  v_capacidad int;
  v_necesarias int;
  v_unidad1 uuid;
  v_unidad2 uuid;
  v_contigua boolean;
  v_fila1 int; v_orden1 int; v_fila2 int; v_orden2 int;
  v_rec record;
  v_vence_at timestamptz;
  v_precio numeric;
  v_total numeric := 0;
  v_codigo text;
  v_cliente_id uuid;
  v_dni text := v_cliente->>'dni';
  v_telefono text := v_cliente->>'telefono_e164';
  v_personas_u1 int;
  v_personas_u2 int;
  v_unidades_out jsonb := '[]'::jsonb;
  v_rango daterange;
  v_count_tel int;
  v_count_user int;
  v_email text;
  v_cc clientes_cuentas;
  v_res jsonb;
begin
  -- 0. Fase 5A: reservar exige una cuenta de cliente (Google). La Edge
  -- Function valida el token y manda el user_id con service_role; nadie
  -- más puede ejecutar esta función.
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'login_requerido', 'mensaje', 'Ingresá con tu cuenta de Google para reservar.');
  end if;
  select lower(btrim(email)) into v_email from auth.users where id = p_user_id;

  v_unidad_ids := (select array_agg(x::uuid) from jsonb_array_elements_text(p->'unidad_ids') x);

  -- 1. Config
  select * into v_config from config_reservas_publicas where id = true for share;
  if not v_config.activo then
    return jsonb_build_object('ok', false, 'error', 'reservas_desactivadas', 'mensaje', 'Las reservas online no están disponibles en este momento.');
  end if;
  if not (v_tipo_alquiler = any(v_config.tipos_alquiler_web)) or v_tipo_unidad not in ('carpa','sombrilla') then
    return jsonb_build_object('ok', false, 'error', 'tipo_no_habilitado', 'mensaje', 'Ese tipo de reserva no está disponible online.');
  end if;

  -- 2. Fechas
  v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ahora_art := now() at time zone 'America/Argentina/Buenos_Aires';

  if v_tipo_alquiler = 'dia' and v_hasta <> v_desde then
    return jsonb_build_object('ok', false, 'error', 'fechas_invalidas', 'mensaje', 'Las fechas elegidas no son válidas.');
  end if;
  if v_tipo_alquiler = 'periodo' and v_hasta <= v_desde then
    return jsonb_build_object('ok', false, 'error', 'fechas_invalidas', 'mensaje', 'Las fechas elegidas no son válidas.');
  end if;
  if v_desde < v_hoy then
    return jsonb_build_object('ok', false, 'error', 'fechas_invalidas', 'mensaje', 'Las fechas elegidas no son válidas.');
  end if;
  if v_desde > v_hoy + v_config.dias_anticipacion_max then
    return jsonb_build_object('ok', false, 'error', 'fuera_de_anticipacion', 'mensaje', 'Esa fecha está demasiado lejos para reservar online todavía.');
  end if;
  if v_desde = v_hoy and (v_ahora_art::time) >= v_config.hora_corte_noshow then
    return jsonb_build_object('ok', false, 'error', 'corte_horario_hoy', 'mensaje', 'Ya pasó el horario límite para reservar hoy online.');
  end if;

  v_rango := daterange(v_desde, v_hasta, '[]');
  if not exists (
    select 1 from temporadas t where t.estado = 'activa' and v_rango <@ daterange(t.fecha_inicio, t.fecha_fin, '[]')
  ) then
    return jsonb_build_object('ok', false, 'error', 'fuera_de_temporada', 'mensaje', 'Esas fechas no caen dentro de la temporada.');
  end if;

  -- 3. Capacidad
  select capacidad into v_capacidad from unidades where id = v_unidad_ids[1];
  v_necesarias := ceil(v_personas::numeric / v_capacidad);
  if v_necesarias > v_config.max_unidades_por_reserva then
    return jsonb_build_object('ok', false, 'error', 'capacidad_excedida', 'mensaje', 'Para esa cantidad de personas, comunicate directamente con nosotros.');
  end if;

  -- 4. Unidades
  if (select count(distinct x) from unnest(v_unidad_ids) x) <> array_length(v_unidad_ids,1) then
    return jsonb_build_object('ok', false, 'error', 'unidades_invalidas', 'mensaje', 'Hubo un problema con las unidades elegidas.');
  end if;
  if exists (
    select 1 from unidades u where u.id = any(v_unidad_ids)
      and (u.tipo <> v_tipo_unidad or not u.habilitada_web)
  ) or (select count(*) from unidades where id = any(v_unidad_ids)) <> array_length(v_unidad_ids,1) then
    return jsonb_build_object('ok', false, 'error', 'unidades_invalidas', 'mensaje', 'Hubo un problema con las unidades elegidas.');
  end if;
  if array_length(v_unidad_ids,1) > v_necesarias then
    return jsonb_build_object('ok', false, 'error', 'unidades_invalidas', 'mensaje', 'Hubo un problema con las unidades elegidas.');
  end if;

  v_unidad1 := v_unidad_ids[1];
  v_unidad2 := null;
  v_contigua := true;

  if v_necesarias = 2 then
    if array_length(v_unidad_ids,1) = 2 then
      v_unidad2 := v_unidad_ids[2];
    else
      select unidad_id, contigua into v_unidad2, v_contigua from buscar_unidad_vecina(v_unidad1, v_desde, v_hasta);
      if v_unidad2 is null then
        return jsonb_build_object('ok', false, 'error', 'sin_vecina_disponible', 'mensaje', 'No encontramos una segunda unidad disponible cerca.');
      end if;
    end if;
  end if;

  -- 5. Vencimiento lazy sobre las unidades elegidas
  update reservas r set estado = 'cancelada', motivo_cancelacion = 'vencida'
  where r.unidad_id in (v_unidad1, v_unidad2)
    and r.estado = 'activa' and r.preconfirmada = true
    and r.rango && v_rango
    and not reserva_activa(r.estado, r.preconfirmada, r.vence_at);

  -- 6. Lock y disponibilidad
  perform 1 from unidades where id in (v_unidad1, v_unidad2) for update;

  if exists (
    select 1 from reservas r
    where r.unidad_id in (v_unidad1, v_unidad2)
      and r.rango && v_rango
      and reserva_activa(r.estado, r.preconfirmada, r.vence_at)
  ) then
    return jsonb_build_object('ok', false, 'error', 'unidad_no_disponible', 'mensaje', 'Esa unidad ya no está disponible para esas fechas.');
  end if;

  -- 7. Límite por teléfono
  select count(distinct r.codigo) into v_count_tel
  from reservas r
  join clientes c on c.id = r.cliente_id
  where c.telefono = v_telefono
    and reserva_activa(r.estado, r.preconfirmada, r.vence_at)
    and r.codigo is not null;
  if v_count_tel >= v_config.max_reservas_activas_por_telefono then
    return jsonb_build_object('ok', false, 'error', 'limite_por_telefono', 'mensaje', 'Ya tenés el máximo de reservas activas permitidas con este teléfono.');
  end if;
  -- El mismo límite, contado por cuenta (Fase 5A).
  select count(distinct r.codigo) into v_count_user
  from reservas r
  join codigos_reserva cr on cr.codigo = r.codigo
  where cr.user_id = p_user_id
    and reserva_activa(r.estado, r.preconfirmada, r.vence_at);
  if v_count_user >= v_config.max_reservas_activas_por_telefono then
    return jsonb_build_object('ok', false, 'error', 'limite_por_cuenta', 'mensaje', 'Ya tenés el máximo de reservas activas permitidas con tu cuenta.');
  end if;

  -- 8. Cliente (Fase 5A): el del vínculo de la cuenta; el bloque cliente del
  -- body queda solo para mostrar. Sin vínculo, se completa la cuenta con los
  -- datos del form (reglas 2 y 3) y la reserva va al cliente resultante,
  -- aunque el vínculo quede pendiente. Nunca se modifica un cliente
  -- existente (D5).
  v_cliente_id := null;
  select * into v_cc from clientes_cuentas where user_id = p_user_id;
  if found then
    v_cliente_id := v_cc.cliente_id;
  else
    v_res := fn_cuenta_completar(p_user_id, v_email, fn_cuenta_email_verificado(p_user_id, v_email),
                                 v_cliente->>'nombre', v_cliente->>'apellido',
                                 coalesce(fn_normalizar_telefono_ar(v_telefono), v_telefono), v_dni);
    v_cliente_id := (v_res->>'cliente_id')::uuid;
  end if;
  -- Sin cliente posible (match ambiguo o cuenta del personal): D5 de siempre.
  if v_cliente_id is null and v_dni is not null then
    select id into v_cliente_id from clientes where dni = v_dni limit 1;
  end if;
  if v_cliente_id is null and v_telefono is not null then
    select id into v_cliente_id from clientes where telefono = v_telefono order by created_at desc limit 1;
  end if;
  if v_cliente_id is null then
    insert into clientes (nombre, apellido, telefono, mail, dni)
    values (v_cliente->>'nombre', v_cliente->>'apellido', v_telefono, v_email, v_dni)
    returning id into v_cliente_id;
  end if;

  -- 9. Precio
  v_precio := cotizar(v_tipo_unidad, v_tipo_alquiler, v_metodo, v_desde, v_hasta);
  if v_precio is null then
    return jsonb_build_object('ok', false, 'error', 'sin_tarifa', 'mensaje', 'No pudimos calcular el precio para esas fechas todavía.');
  end if;

  -- 10. Código
  v_codigo := generar_codigo_reserva();
  insert into codigos_reserva (codigo, metodo_pago_previsto, unidades_contiguas, lead_id, user_id)
  values (v_codigo, v_metodo, (v_unidad2 is null or v_contigua), v_lead_id, p_user_id);

  v_vence_at := (v_desde + v_config.hora_corte_noshow) at time zone 'America/Argentina/Buenos_Aires';

  -- 11. Insert de reservas
  v_personas_u1 := least(v_personas, v_capacidad);
  v_personas_u2 := v_personas - v_personas_u1;

  begin
    if v_tipo_alquiler = 'dia' then
      insert into reservas (cliente_id, unidad_id, tipo_alquiler, fecha, precio_lista, ajuste, valor_total, cantidad_personas, origen, preconfirmada, estado, codigo, vence_at)
      values (v_cliente_id, v_unidad1, v_tipo_alquiler, v_desde, v_precio, 0, v_precio, v_personas_u1, 'web', true, 'activa', v_codigo, v_vence_at);
    else
      insert into reservas (cliente_id, unidad_id, tipo_alquiler, fecha_inicio, fecha_fin, precio_lista, ajuste, valor_total, cantidad_personas, origen, preconfirmada, estado, codigo, vence_at)
      values (v_cliente_id, v_unidad1, v_tipo_alquiler, v_desde, v_hasta, v_precio, 0, v_precio, v_personas_u1, 'web', true, 'activa', v_codigo, v_vence_at);
    end if;

    select tipo, numero into v_rec from unidades where id = v_unidad1;
    v_unidades_out := v_unidades_out || jsonb_build_object('unidad_id', v_unidad1, 'tipo', v_rec.tipo, 'numero', v_rec.numero);
    v_total := v_total + v_precio;

    if v_unidad2 is not null then
      if v_tipo_alquiler = 'dia' then
        insert into reservas (cliente_id, unidad_id, tipo_alquiler, fecha, precio_lista, ajuste, valor_total, cantidad_personas, origen, preconfirmada, estado, codigo, vence_at)
        values (v_cliente_id, v_unidad2, v_tipo_alquiler, v_desde, v_precio, 0, v_precio, v_personas_u2, 'web', true, 'activa', v_codigo, v_vence_at);
      else
        insert into reservas (cliente_id, unidad_id, tipo_alquiler, fecha_inicio, fecha_fin, precio_lista, ajuste, valor_total, cantidad_personas, origen, preconfirmada, estado, codigo, vence_at)
        values (v_cliente_id, v_unidad2, v_tipo_alquiler, v_desde, v_hasta, v_precio, 0, v_precio, v_personas_u2, 'web', true, 'activa', v_codigo, v_vence_at);
      end if;
      select tipo, numero into v_rec from unidades where id = v_unidad2;
      v_unidades_out := v_unidades_out || jsonb_build_object('unidad_id', v_unidad2, 'tipo', v_rec.tipo, 'numero', v_rec.numero);
      v_total := v_total + v_precio;
    end if;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'unidad_no_disponible', 'mensaje', 'Esa unidad ya no está disponible para esas fechas.');
  end;

  -- 12. Lead convertido
  if v_lead_id is not null then
    update leads set estado = 'convertido' where id = v_lead_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'url', 'https://priusplayagrande.com.ar/r/' || v_codigo,
    'unidades', v_unidades_out,
    'tipo_alquiler', v_tipo_alquiler,
    'desde', v_desde,
    'hasta', v_hasta,
    'cantidad_personas', v_personas,
    'metodo_pago', v_metodo,
    'total', v_total,
    'unidades_contiguas', (v_unidad2 is null or v_contigua)
  );
end $function$;

revoke all on function public.crear_reserva_publica(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.crear_reserva_publica(jsonb, uuid) to service_role;

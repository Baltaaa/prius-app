-- Fase 6A, Tarea 2B (19/11/2026), pedido del administrador: Ana Lescano pasa de
-- 3 reservas por período con precio unificado (grupo f8dab462, migración del
-- Excel) a UNA reserva de temporada en la carpa 74, bloqueada, $ 3.100.000
-- saldados. No se modifica ningún dato del cliente; los pagos solo cambian de
-- reserva_id (montos, medios, fechas, caja, comprobantes y estado idénticos).
--
-- Orden (importa): pagos.reserva_id es ON DELETE CASCADE, así que primero se
-- mueven los pagos y recién con las originales vacías se borran.
-- La reserva nueva se inserta 'cancelada' y se activa al final: activa desde el
-- principio choca con reservas_sin_superposicion contra enero y marzo.
-- Todo en una transacción: cualquier verificación que no dé -> raise -> rollback.
do $$
declare
  c_cliente   constant uuid := '58c5acd3-4bdf-4277-878b-be1555024ee0';
  c_unidad    constant uuid := '5b7a5eec-d519-46a8-9a07-3e3e996fb1f0'; -- carpa 74
  c_temporada constant uuid := 'd96ad586-3f83-4a32-9f24-ca3d8049a48f'; -- 2026/2027
  c_grupo     constant uuid := 'f8dab462-e956-42d5-898b-f430d1c8b7d5';
  c_comprob   constant uuid := '51c3a457-de5a-4f01-bf5b-fc86a39caa79'; -- RB 1891
  c_total     constant numeric := 3100000;
  c_originales constant uuid[] := array[
    'b0664c3f-20b8-4f24-aa63-ce5887b73e03', -- enero (activa)
    'db2ac43f-3a49-4b56-a510-a57afc8a3952', -- febrero (cancelada el 18/11)
    'c272aab8-261b-4ad1-8ff4-41f6a0d0f93e'  -- marzo (activa)
  ]::uuid[];
  v_nueva uuid;
  v_temp_ini date;
  v_temp_fin date;
  v_pagos_antes int; v_vig_antes int; v_suma_antes numeric; v_ids_pagos uuid[];
  v_cajas_antes text; v_cajas_despues text;
  v_n int; v_suma numeric;
  v_r record;
  v_dia date;
  v_notif int;
  v_pagos_despues int;
begin
  ---------------------------------------------------------------- guardas
  select fecha_inicio, fecha_fin into v_temp_ini, v_temp_fin from temporadas where id = c_temporada and estado = 'activa';
  if v_temp_ini is null then raise exception 'fase6a: la temporada 2026/2027 no está activa'; end if;

  select count(*) into v_n from reservas
   where id = any(c_originales) and cliente_id = c_cliente and unidad_id = c_unidad
     and tipo_alquiler = 'periodo' and grupo_id = c_grupo;
  if v_n <> 3 then raise exception 'fase6a: las 3 reservas originales no están como en la auditoría (%)', v_n; end if;

  if exists (select 1 from reservas where grupo_id = c_grupo and not (id = any(c_originales))) then
    raise exception 'fase6a: otra reserva usa el grupo %', c_grupo;
  end if;

  -- Paso 1 del pedido: otra reserva activa en la 74 dentro de la temporada -> no seguir.
  select count(*) into v_n from reservas r
   where r.unidad_id = c_unidad and not (r.id = any(c_originales))
     and r.rango && daterange(v_temp_ini, v_temp_fin, '[]')
     and reserva_activa(r.estado, r.preconfirmada, r.vence_at);
  if v_n > 0 then raise exception 'fase6a: hay % reserva(s) activa(s) de otro cliente en la carpa 74 dentro de la temporada', v_n; end if;

  select count(*), count(*) filter (where estado = 'vigente'),
         coalesce(sum(monto) filter (where estado = 'vigente'), 0), array_agg(id order by id)
    into v_pagos_antes, v_vig_antes, v_suma_antes, v_ids_pagos
    from pagos where reserva_id = any(c_originales);
  if v_pagos_antes <> 3 or v_vig_antes <> 1 or v_suma_antes <> c_total then
    raise exception 'fase6a: pagos distintos a la auditoría (total %, vigentes %, suma %)', v_pagos_antes, v_vig_antes, v_suma_antes;
  end if;
  if exists (select 1 from pagos where cliente_id = c_cliente and not (id = any(v_ids_pagos))) then
    raise exception 'fase6a: Ana tiene pagos fuera de las 3 reservas';
  end if;

  select md5(coalesce(string_agg(concat_ws('|', id, total_cobros, total_gastos, total_neto, resumen_snapshot::text), ';' order by id), ''))
    into v_cajas_antes from caja_diaria;

  ---------------------------------------------------------------- 2. reserva nueva
  insert into reservas (cliente_id, unidad_id, tipo_alquiler, temporada_id, temporada,
                        precio_lista, ajuste, bloqueada, grupo_id, origen, created_by, notas, estado)
  values (c_cliente, c_unidad, 'temporada', c_temporada, '2026/2027',
          c_total, 0, true, null, 'manual', null, null, 'cancelada')
  returning id into v_nueva;

  -- Mismos co-socios que las originales (hoy: solo Ana).
  insert into reserva_clientes (reserva_id, cliente_id)
  select distinct v_nueva, rc.cliente_id from reserva_clientes rc where rc.reserva_id = any(c_originales);

  ---------------------------------------------------------------- 3. mover pagos
  update pagos set reserva_id = v_nueva where reserva_id = any(c_originales);

  ---------------------------------------------------------------- 4. borrar originales y grupo
  if exists (select 1 from pagos where reserva_id = any(c_originales)) then
    raise exception 'fase6a: quedaron pagos en las reservas originales';
  end if;
  delete from reservas where id = any(c_originales);
  delete from reserva_grupos where id = c_grupo and not exists (select 1 from reservas where grupo_id = c_grupo);

  update reservas set estado = 'activa' where id = v_nueva;

  ---------------------------------------------------------------- 5. historial
  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento, actor_nombre, cliente_id, cliente_nombre)
  select 'reservas', 'UPDATE', v_nueva,
         'Pasada a temporada completa a pedido del administrador (antes: 3 períodos, precio unificado $ 3.100.000)',
         public.fn_hoy_ar(),
         jsonb_build_object('reservas_originales', to_jsonb(c_originales), 'grupo_original', c_grupo,
                            'pagos_movidos', to_jsonb(v_ids_pagos)),
         null, 'reserva_editada', 'Sistema', c_cliente, c.nombre
    from clientes c where c.id = c_cliente;

  -- Novedades todavía visibles sobre la reserva de febrero, que ya no existe. Una
  -- novedad no se "resuelve" (notificaciones_categoria_campos): se la vence.
  update notificaciones set expira_at = now()
   where entidad_id = 'db2ac43f-3a49-4b56-a510-a57afc8a3952' and categoria = 'novedad' and expira_at > now();
  get diagnostics v_notif = row_count;

  ---------------------------------------------------------------- 6. verificaciones
  select * into v_r from reservas where id = v_nueva;
  if v_r.estado <> 'activa' or v_r.tipo_alquiler <> 'temporada' or v_r.unidad_id <> c_unidad
     or not v_r.bloqueada or v_r.valor_total <> c_total or v_r.precio_lista <> c_total or v_r.ajuste <> 0
     or v_r.saldo is distinct from 0::numeric or v_r.estado_pago <> 'pagado' or v_r.grupo_id is not null
     or v_r.temporada_id <> c_temporada or v_r.pendiente_verificacion or v_r.estado_pago_manual then
    raise exception 'fase6a: la reserva nueva no quedó bien: %', to_jsonb(v_r);
  end if;

  select count(*) into v_n from reservas r
   where (r.cliente_id = c_cliente or exists (select 1 from reserva_clientes rc where rc.reserva_id = r.id and rc.cliente_id = c_cliente));
  if v_n <> 1 then raise exception 'fase6a: Ana tiene % reservas (esperaba 1)', v_n; end if;

  select count(*), coalesce(sum(monto) filter (where estado = 'vigente'), 0) into v_pagos_despues, v_suma
    from pagos where reserva_id = v_nueva;
  if v_pagos_despues <> v_pagos_antes or v_suma <> v_suma_antes then
    raise exception 'fase6a: pagos después (%, %) distintos de antes (%, %)', v_pagos_despues, v_suma, v_pagos_antes, v_suma_antes;
  end if;
  if (select array_agg(id order by id) from pagos where reserva_id = v_nueva) <> v_ids_pagos then
    raise exception 'fase6a: no son los mismos pagos';
  end if;
  if not exists (select 1 from comprobantes c join pagos p on p.id = c.pago_id
                  where c.id = c_comprob and c.estado = 'vigente' and p.reserva_id = v_nueva and p.comprobante_id = c_comprob) then
    raise exception 'fase6a: el comprobante RB 1891 no quedó vinculado al pago de la reserva nueva';
  end if;

  select md5(coalesce(string_agg(concat_ws('|', id, total_cobros, total_gastos, total_neto, resumen_snapshot::text), ';' order by id), ''))
    into v_cajas_despues from caja_diaria;
  if v_cajas_despues <> v_cajas_antes then raise exception 'fase6a: cambiaron totales o resumen_snapshot de alguna caja'; end if;

  -- disponibilidad_publica: la 74 ocupada en cada día de la temporada.
  v_dia := v_temp_ini;
  while v_dia <= v_temp_fin loop
    if not coalesce((select d.bloqueada from public.disponibilidad_publica(v_dia, v_dia) d where d.unidad_id = c_unidad), false) then
      raise exception 'fase6a: disponibilidad_publica marca la carpa 74 libre el %', v_dia;
    end if;
    v_dia := v_dia + 1;
  end loop;

  -- reservas_sin_superposicion: ningún par de reservas activas superpuesto en la misma unidad.
  select count(*) into v_n from reservas a join reservas b
    on a.unidad_id = b.unidad_id and a.id < b.id and a.rango && b.rango
   where a.estado = 'activa' and b.estado = 'activa';
  if v_n > 0 then raise exception 'fase6a: % superposición(es) entre reservas activas', v_n; end if;

  if (select estado from unidades where id = c_unidad) <> 'ocupada' then
    raise exception 'fase6a: la carpa 74 no quedó ocupada';
  end if;

  raise notice 'fase6a OK: reserva % | pagos % (vigentes $ %) | notificaciones resueltas %', v_nueva, v_pagos_despues, v_suma, v_notif;
end $$;

-- Caja diaria por fecha real (oct 2026): empieza en 0, sin monto inicial
-- arrastrado; el caja_id de un pago/gasto lo decide SU PROPIA fecha, no "la
-- caja que esté abierta ahora". Ver CLAUDE.md "Caja diaria (reglas
-- definitivas oct 2026)".

-- 1) Resuelve (y auto-crea si falta) la caja_diaria de una fecha dada.
--    Nunca toca saldo_apertura de una fila ya existente. Antes del corte
--    (fn_caja_inicio) no hay caja: el pago queda histórico (caja_id null).
create or replace function fn_resolver_caja_id(p_fecha date)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  if p_fecha is null or p_fecha < fn_caja_inicio() then
    return null;
  end if;

  insert into caja_diaria (fecha, saldo_apertura, estado)
  values (p_fecha, 0, 'abierta')
  on conflict (fecha) do nothing;

  select id into v_id from caja_diaria where fecha = p_fecha;
  return v_id;
end;
$$;

revoke all on function fn_resolver_caja_id(date) from public, anon, authenticated;

-- 2) registrar_pago / fn_registrar_pago_interno: caja_id por fecha del pago,
--    nunca más "la caja abierta en este instante". Como la caja se
--    auto-crea, un cobro nunca se bloquea por "caja cerrada".
create or replace function public.fn_registrar_pago_interno(p_reserva_id uuid, p_cliente_id uuid, p_monto numeric, p_medio text, p_tipo_pago text, p_concepto text, p_referencia text, p_comprobante jsonb, p_permitir_excedente boolean, p_fecha date default CURRENT_DATE)
 returns pagos
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
  v_caja_id uuid;
  v_comprobante_id uuid;
  v_pago pagos;
  v_pagado numeric;
  v_fecha date := coalesce(p_fecha, current_date);
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a 0.';
  end if;

  if p_reserva_id is not null then
    select * into v_reserva from reservas where id = p_reserva_id;
    if not found then raise exception 'La reserva no existe.'; end if;
    if v_reserva.bonificada then
      raise exception 'La reserva está bonificada: no admite pagos.';
    end if;
    select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = p_reserva_id and estado = 'vigente';
    if not p_permitir_excedente and (v_pagado + p_monto) > coalesce(v_reserva.valor_total, 0) then
      raise exception 'El monto supera el saldo de la reserva (saldo actual: %). Confirmá el excedente para continuar.', greatest(coalesce(v_reserva.valor_total,0) - v_pagado, 0)
        using errcode = 'P0002';
    end if;
  end if;

  -- Caja por fecha real del pago (Tarea 3, oct 2026): se auto-crea sola,
  -- nunca exige una "caja abierta" aparte ni bloquea el cobro.
  v_caja_id := fn_resolver_caja_id(v_fecha);

  insert into pagos (
    reserva_id, cliente_id, caja_id, monto, medio, tipo_pago, concepto, referencia,
    comprobante_id, origen, estado, registrado_por, fecha
  ) values (
    p_reserva_id, p_cliente_id, v_caja_id, p_monto, p_medio, p_tipo_pago, p_concepto, p_referencia,
    null, 'crm', 'vigente', auth.uid(), v_fecha
  ) returning * into v_pago;

  if p_comprobante is not null then
    if p_comprobante ? 'comprobante_id' then
      v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
      update comprobantes set pago_id = v_pago.id where id = v_comprobante_id and pago_id is null;
      if not found then
        raise exception 'El comprobante no existe o ya está cargado en otro pago.';
      end if;
    else
      v_comprobante_id := fn_vincular_comprobante(
        p_comprobante->>'tipo',
        (p_comprobante->>'punto_venta')::integer,
        p_comprobante->>'numero',
        coalesce((p_comprobante->>'fecha')::date, v_fecha),
        p_cliente_id,
        v_pago.id
      );
    end if;

    update pagos set comprobante_id = v_comprobante_id where id = v_pago.id returning * into v_pago;
    update comprobantes set monto_total = (
      select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
    ) where id = v_comprobante_id;
  end if;

  if v_caja_id is not null then
    perform fn_recalcula_totales_caja(v_caja_id);
  end if;

  return v_pago;
exception
  when sqlstate 'P0002' or sqlstate 'P0004' then
    raise;
  when unique_violation then
    raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then
    raise exception 'Los datos del pago o el comprobante no son válidos.';
  when foreign_key_violation then
    raise exception 'El cliente o la reserva asociada no existe.';
end;
$function$;

-- 3) registrar_gasto: mismo criterio (fecha real en hora Argentina), no
--    exige "caja abierta" aparte.
create or replace function public.registrar_gasto(p_concepto text, p_categoria text, p_medio_pago text, p_monto numeric, p_proveedor text default null::text, p_comprobante_proveedor text default null::text)
 returns gastos_caja
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_caja_id uuid;
  v_gasto gastos_caja;
  v_fecha date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor a 0.'; end if;

  v_caja_id := fn_resolver_caja_id(v_fecha);

  insert into gastos_caja (caja_id, descripcion, categoria, medio_pago, monto, proveedor, comprobante_proveedor, estado, registrado_por)
  values (v_caja_id, p_concepto, p_categoria, p_medio_pago, p_monto, p_proveedor, p_comprobante_proveedor, 'vigente', auth.uid())
  returning * into v_gasto;

  perform fn_recalcula_totales_caja(v_caja_id);

  return v_gasto;
end;
$function$;

-- 4) abrir_caja: ya no pide monto inicial (siempre 0) ni exige que no haya
--    "otra caja abierta" — desde oct 2026 varias cajas pueden estar
--    'abierta' (= todavía sin cerrar/arquear) al mismo tiempo, una por día.
--    Se mantiene solo para marcar explícitamente abierta_por/abierta_at.
create or replace function public.abrir_caja(p_monto_inicial numeric default 0)
 returns caja_diaria
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_fecha date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_caja caja_diaria;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.';
  end if;

  insert into caja_diaria (fecha, saldo_apertura, estado, abierta_por, abierta_at)
  values (v_fecha, 0, 'abierta', auth.uid(), now())
  on conflict (fecha) do update set
    estado = 'abierta',
    abierta_por = coalesce(caja_diaria.abierta_por, excluded.abierta_por),
    abierta_at = coalesce(caja_diaria.abierta_at, excluded.abierta_at),
    cerrada_at = null
  returning * into v_caja;

  -- cobros web entrados con la caja cerrada se asignan a la caja que recién abre
  update pagos set caja_id = v_caja.id
  where origen = 'web' and estado = 'vigente' and caja_id is null and fecha = v_fecha;

  perform fn_recalcula_totales_caja(v_caja.id);
  select * into v_caja from caja_diaria where id = v_caja.id;

  insert into caja_eventos (caja_id, tipo, detalle, usuario)
  values (v_caja.id, 'apertura', jsonb_build_object('monto_inicial', 0), auth.uid());

  return v_caja;
end;
$function$;

-- 5) reabrir_caja: sin el bloqueo de exclusividad (varias cajas pueden
--    seguir 'abierta' a la vez bajo el nuevo modelo).
create or replace function public.reabrir_caja(p_caja_id uuid, p_motivo text)
 returns caja_diaria
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_caja caja_diaria;
begin
  if not es_superadmin() then
    raise exception 'Solo el dueño puede reabrir una caja.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo de la reapertura es obligatorio.';
  end if;

  update caja_diaria set estado = 'abierta', cerrada_at = null
  where id = p_caja_id and estado = 'cerrada'
  returning * into v_caja;

  if not found then raise exception 'La caja no existe o ya está abierta.'; end if;

  insert into caja_eventos (caja_id, tipo, detalle, usuario)
  values (p_caja_id, 'reapertura', jsonb_build_object('motivo', p_motivo), auth.uid());

  return v_caja;
end;
$function$;

-- 6) cerrar_caja: esperado = efectivo del día (pagos) - gastos efectivo del
--    día. Ya no suma saldo_apertura (que ahora siempre es 0, pero se deja
--    la columna por compatibilidad de datos históricos pre-oct-2026).
create or replace function public.cerrar_caja(p_caja_id uuid, p_efectivo_contado numeric, p_datos_z jsonb default null::jsonb, p_observaciones text default null::text)
 returns caja_diaria
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_caja caja_diaria;
  v_efectivo_vigente numeric;
  v_gastos_efectivo numeric;
  v_esperado numeric;
  v_diferencia numeric;
begin
  select * into v_caja from caja_diaria where id = p_caja_id for update;
  if not found then raise exception 'Caja no encontrada.'; end if;
  if v_caja.estado <> 'abierta' then raise exception 'La caja ya está cerrada.'; end if;

  select coalesce(sum(monto), 0) into v_efectivo_vigente
  from pagos where caja_id = p_caja_id and estado = 'vigente' and medio = 'efectivo';
  select coalesce(sum(monto), 0) into v_gastos_efectivo
  from gastos_caja where caja_id = p_caja_id and estado = 'vigente' and medio_pago = 'efectivo';

  v_esperado := v_efectivo_vigente - v_gastos_efectivo;
  v_diferencia := coalesce(p_efectivo_contado, 0) - v_esperado;

  if v_diferencia <> 0 and (p_observaciones is null or btrim(p_observaciones) = '') then
    raise exception 'Hay diferencia de arqueo ($%): las observaciones son obligatorias.', v_diferencia;
  end if;

  update caja_diaria set
    estado = 'cerrada',
    cerrada_por = auth.uid(),
    cerrada_at = now(),
    efectivo_esperado = v_esperado,
    efectivo_contado = p_efectivo_contado,
    diferencia = v_diferencia,
    observaciones_cierre = p_observaciones,
    z_numero = p_datos_z->>'z_numero',
    z_fecha = nullif(p_datos_z->>'z_fecha','')::date,
    z_total = nullif(p_datos_z->>'z_total','')::numeric,
    z_neto_gravado = nullif(p_datos_z->>'z_neto_gravado','')::numeric,
    z_iva = nullif(p_datos_z->>'z_iva','')::numeric,
    z_cantidad_comprobantes = nullif(p_datos_z->>'z_cantidad_comprobantes','')::integer,
    z_primer_comprobante = p_datos_z->>'z_primer_comprobante',
    z_ultimo_comprobante = p_datos_z->>'z_ultimo_comprobante'
  where id = p_caja_id
  returning * into v_caja;

  update caja_diaria set resumen_snapshot = resumen_caja(p_caja_id) where id = p_caja_id
  returning * into v_caja;

  insert into caja_eventos (caja_id, tipo, detalle, usuario)
  values (p_caja_id, 'cierre', jsonb_build_object('efectivo_contado', p_efectivo_contado, 'diferencia', v_diferencia), auth.uid());

  return v_caja;
end;
$function$;

-- 7) resumen_caja: esperado (caja abierta) sin saldo_apertura; arqueo.inicial
--    queda en 0 (ya no existe el concepto); movimientos llevan
--    "cargado después del cierre" cuando corresponde (Tarea 3.8).
create or replace function public.resumen_caja(p_caja_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_caja caja_diaria;
  v_result jsonb;
  v_esperado numeric;
begin
  select * into v_caja from caja_diaria where id = p_caja_id;
  if not found then raise exception 'Caja no encontrada.'; end if;

  if v_caja.estado = 'abierta' then
    select
      coalesce((select sum(monto) from pagos where caja_id = p_caja_id and estado = 'vigente' and medio = 'efectivo'), 0)
      - coalesce((select sum(monto) from gastos_caja where caja_id = p_caja_id and estado = 'vigente' and medio_pago = 'efectivo'), 0)
    into v_esperado;
  else
    v_esperado := v_caja.efectivo_esperado;
  end if;

  v_result := jsonb_build_object(
    'cabecera', jsonb_build_object(
      'caja_id', v_caja.id, 'fecha', v_caja.fecha, 'estado', v_caja.estado,
      'abierta_por', v_caja.abierta_por, 'abierta_at', v_caja.abierta_at,
      'cerrada_por', v_caja.cerrada_por, 'cerrada_at', v_caja.cerrada_at,
      'abierta_por_nombre', (select nombre from perfiles where user_id = v_caja.abierta_por),
      'cerrada_por_nombre', (select nombre from perfiles where user_id = v_caja.cerrada_por)
    ),
    'totales', jsonb_build_object(
      'ingresos', coalesce((select sum(monto) from pagos where caja_id = p_caja_id and estado = 'vigente'), 0),
      'egresos', coalesce((select sum(monto) from gastos_caja where caja_id = p_caja_id and estado = 'vigente'), 0),
      'neto', coalesce((select sum(monto) from pagos where caja_id = p_caja_id and estado = 'vigente'), 0)
             - coalesce((select sum(monto) from gastos_caja where caja_id = p_caja_id and estado = 'vigente'), 0)
    ),
    'por_medio', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select medio, sum(ingresos) as ingresos, sum(egresos) as egresos, sum(ingresos) - sum(egresos) as neto from (
          select medio, monto as ingresos, 0 as egresos from pagos where caja_id = p_caja_id and estado = 'vigente'
          union all
          select medio_pago as medio, 0, monto from gastos_caja where caja_id = p_caja_id and estado = 'vigente'
        ) x group by medio
      ) t
    ),
    'arqueo', jsonb_build_object(
      'inicial', 0, 'esperado', v_esperado,
      'contado', v_caja.efectivo_contado, 'diferencia', v_caja.diferencia
    ),
    'z', jsonb_build_object(
      'numero', v_caja.z_numero, 'fecha', v_caja.z_fecha, 'total', v_caja.z_total,
      'neto_gravado', v_caja.z_neto_gravado, 'iva', v_caja.z_iva,
      'cantidad_comprobantes', v_caja.z_cantidad_comprobantes,
      'primer_comprobante', v_caja.z_primer_comprobante, 'ultimo_comprobante', v_caja.z_ultimo_comprobante,
      'comparacion', jsonb_build_object(
        'diferencia_total', v_caja.z_total - coalesce((
          select sum(cm.monto_total) from comprobantes cm
          join pagos p on p.comprobante_id = cm.id
          where p.caja_id = p_caja_id and cm.estado = 'vigente'
        ), 0),
        'diferencia_cantidad', v_caja.z_cantidad_comprobantes - (
          select count(distinct cm.id) from comprobantes cm
          join pagos p on p.comprobante_id = cm.id
          where p.caja_id = p_caja_id and cm.estado = 'vigente'
        )
      )
    ),
    'facturas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'etiqueta', fn_comprobante_etiqueta(cm), 'tipo', cm.tipo, 'fecha', cm.fecha, 'monto_total', cm.monto_total, 'estado', cm.estado,
        'cliente', (select c.nombre from pagos p left join clientes c on c.id = p.cliente_id where p.comprobante_id = cm.id and p.caja_id = p_caja_id limit 1),
        'medio', (select p.medio from pagos p where p.comprobante_id = cm.id and p.caja_id = p_caja_id limit 1)
      ) order by cm.tipo, cm.numero), '[]'::jsonb)
      from comprobantes cm where cm.tipo like 'factura_%'
        and exists (select 1 from pagos p where p.comprobante_id = cm.id and p.caja_id = p_caja_id)
    ),
    'recibos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'etiqueta', fn_comprobante_etiqueta(cm), 'tipo', cm.tipo, 'fecha', cm.fecha, 'monto_total', cm.monto_total, 'estado', cm.estado,
        'cliente', (select c.nombre from pagos p left join clientes c on c.id = p.cliente_id where p.comprobante_id = cm.id and p.caja_id = p_caja_id limit 1),
        'medio', (select p.medio from pagos p where p.comprobante_id = cm.id and p.caja_id = p_caja_id limit 1)
      ) order by cm.tipo, cm.numero), '[]'::jsonb)
      from comprobantes cm where cm.tipo like 'recibo_%'
        and exists (select 1 from pagos p where p.comprobante_id = cm.id and p.caja_id = p_caja_id)
    ),
    'sin_comprobante', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pago_id', p.id, 'fecha_hora', p.fecha_hora, 'cliente', c.nombre, 'monto', p.monto, 'medio', p.medio, 'concepto', p.concepto
      ) order by p.fecha_hora), '[]'::jsonb)
      from pagos p left join clientes c on c.id = p.cliente_id
      where p.caja_id = p_caja_id and p.estado = 'vigente' and p.comprobante_id is null
    ),
    'gastos', jsonb_build_object(
      'por_categoria', (
        select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'total', total)), '[]'::jsonb)
        from (select categoria, sum(monto) as total from gastos_caja where caja_id = p_caja_id and estado = 'vigente' group by categoria) t
      ),
      'detalle', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'gasto_id', g.id, 'fecha_hora', g.created_at, 'concepto', g.descripcion, 'categoria', g.categoria,
          'medio_pago', g.medio_pago, 'monto', g.monto, 'proveedor', g.proveedor, 'estado', g.estado,
          'tras_cierre', (v_caja.cerrada_at is not null and g.created_at > v_caja.cerrada_at)
        ) order by g.created_at), '[]'::jsonb)
        from gastos_caja g where g.caja_id = p_caja_id and g.estado = 'vigente'
      )
    ),
    'anulados', jsonb_build_object(
      'pagos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'pago_id', p.id, 'monto', p.monto, 'medio', p.medio, 'motivo', p.anulado_motivo, 'anulado_at', p.anulado_at,
          'cliente', c.nombre, 'anulado_por', pf.nombre,
          'comprobante', (select fn_comprobante_etiqueta(cm) from comprobantes cm where cm.id = p.comprobante_id)
        )), '[]'::jsonb)
        from pagos p left join clientes c on c.id = p.cliente_id left join perfiles pf on pf.user_id = p.anulado_por
        where p.caja_id = p_caja_id and p.estado = 'anulado'
      ),
      'gastos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'gasto_id', g.id, 'monto', g.monto, 'motivo', g.anulado_motivo, 'anulado_at', g.anulado_at,
          'proveedor', g.proveedor, 'anulado_por', pf.nombre
        )), '[]'::jsonb)
        from gastos_caja g left join perfiles pf on pf.user_id = g.anulado_por
        where g.caja_id = p_caja_id and g.estado = 'anulado'
      )
    ),
    'movimientos', (
      select coalesce(jsonb_agg(m order by m->>'hora'), '[]'::jsonb) from (
        select jsonb_build_object(
          'hora', p.fecha_hora, 'tipo', 'cobro',
          'comprobante', (select fn_comprobante_etiqueta(cm) from comprobantes cm where cm.id = p.comprobante_id),
          'cliente_proveedor', c.nombre,
          'unidad', case when u.id is not null then jsonb_build_object('tipo', u.tipo, 'numero', u.numero) else null end,
          'codigo_reserva', r.codigo,
          'concepto', p.concepto,
          'medio', p.medio,
          'monto', p.monto,
          'cargado_por', pf.nombre,
          'tras_cierre', (v_caja.cerrada_at is not null and p.fecha_hora > v_caja.cerrada_at)
        ) as m
        from pagos p
        left join clientes c on c.id = p.cliente_id
        left join reservas r on r.id = p.reserva_id
        left join unidades u on u.id = r.unidad_id
        left join perfiles pf on pf.user_id = p.registrado_por
        where p.caja_id = p_caja_id and p.estado = 'vigente'
        union all
        select jsonb_build_object(
          'hora', g.created_at, 'tipo', 'gasto',
          'comprobante', null,
          'cliente_proveedor', g.proveedor,
          'unidad', null,
          'codigo_reserva', null,
          'concepto', g.descripcion,
          'medio', g.medio_pago,
          'monto', -g.monto,
          'cargado_por', pf.nombre,
          'tras_cierre', (v_caja.cerrada_at is not null and g.created_at > v_caja.cerrada_at)
        ) as m
        from gastos_caja g
        left join perfiles pf on pf.user_id = g.registrado_por
        where g.caja_id = p_caja_id and g.estado = 'vigente'
      ) t
    )
  );

  return v_result;
end;
$function$;

-- 8) Backfill: cada pago/gasto desde el corte (01/10/2026) a la caja de su
--    propia fecha; los anteriores al corte nunca tocan ninguna caja.
update pagos set caja_id = fn_resolver_caja_id(fecha)
where fecha is not null and fecha >= fn_caja_inicio();

update pagos set caja_id = null
where fecha is not null and fecha < fn_caja_inicio() and caja_id is not null;

update gastos_caja g set caja_id = fn_resolver_caja_id((g.created_at at time zone 'America/Argentina/Buenos_Aires')::date)
where (g.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= fn_caja_inicio();

do $$
declare v_id uuid;
begin
  for v_id in select id from caja_diaria where fecha >= fn_caja_inicio() loop
    perform fn_recalcula_totales_caja(v_id);
  end loop;
end $$;

update caja_diaria set saldo_apertura = 0
where fecha >= fn_caja_inicio() and saldo_apertura <> 0;

do $$
declare
  v_id uuid;
  v_efectivo numeric;
  v_gastos numeric;
  v_esperado numeric;
begin
  for v_id in select id from caja_diaria where estado = 'cerrada' and fecha >= fn_caja_inicio() loop
    select coalesce(sum(monto), 0) into v_efectivo from pagos where caja_id = v_id and estado = 'vigente' and medio = 'efectivo';
    select coalesce(sum(monto), 0) into v_gastos from gastos_caja where caja_id = v_id and estado = 'vigente' and medio_pago = 'efectivo';
    v_esperado := v_efectivo - v_gastos;
    update caja_diaria set
      efectivo_esperado = v_esperado,
      diferencia = coalesce(efectivo_contado, 0) - v_esperado
    where id = v_id;
    update caja_diaria set resumen_snapshot = resumen_caja(v_id) where id = v_id;
  end loop;
end $$;

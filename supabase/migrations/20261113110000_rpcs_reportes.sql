-- Fuente única de números (nov 2026, Tarea 2).
--
-- Reportes, el PDF, el push y el WhatsApp leen SOLO de estas funciones: el
-- front no vuelve a bajar filas crudas para sumar. Son `security invoker`, así
-- que respetan la RLS de quien las llama (la Edge Function usa service role).
--
-- Reglas que codifican:
--   * El flujo (ingresos, egresos, neto) arranca en fn_caja_inicio() =
--     1/10/2026. Los pagos históricos anteriores no cuentan como flujo, pero
--     sí en el "cobrado de la temporada".
--   * El peso es la moneda principal. Lo que entró en dólares se informa al
--     tipo de cambio que quedó guardado en cada pago, nunca al de hoy.
--   * Sin datos para comparar devuelve null, nunca un 0% inventado.
--   * Todo día es día argentino (fn_hoy_ar / caja_diaria.fecha).

-- ------------------------------------------------------------- fn_delta_pct
create or replace function public.fn_delta_pct(p_actual numeric, p_previo numeric)
returns numeric
language sql
immutable
as $fn$
  select case
    when p_previo is null or p_previo = 0 or p_actual is null then null
    else round(100 * (p_actual - p_previo) / abs(p_previo), 1)
  end;
$fn$;

grant execute on function public.fn_delta_pct(numeric, numeric) to authenticated;

-- ------------------------------------------------- reporte_ocupacion_dia
-- Ocupada = unidad con reserva activa cuyo rango contiene la fecha, de
-- cualquier tipo_alquiler (incluye preconfirmadas y bonificadas).
create or replace function public.reporte_ocupacion_dia(p_fecha date)
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
  with por_unidad as (
    select
      u.tipo,
      exists (
        select 1 from reservas r
        where r.unidad_id = u.id and r.estado = 'activa' and r.rango @> p_fecha
      ) as ocupada,
      exists (
        select 1 from reservas r
        where r.unidad_id = u.id and r.estado = 'activa' and r.rango @> p_fecha
          and r.bonificada
      ) as bonificada
    from unidades u
  ),
  por_tipo as (
    select
      tipo,
      count(*)::int as total,
      count(*) filter (where ocupada)::int as ocupadas,
      count(*) filter (where not ocupada)::int as libres,
      count(*) filter (where bonificada)::int as bonificadas
    from por_unidad group by tipo
  )
  select jsonb_build_object(
    'fecha', p_fecha,
    'por_tipo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', tipo,
        'total', total,
        'ocupadas', ocupadas,
        'libres', libres,
        'bonificadas', bonificadas,
        'pct', case when total = 0 then null else round(100.0 * ocupadas / total, 1) end
      ) order by tipo) from por_tipo
    ), '[]'::jsonb),
    'total', (
      select jsonb_build_object(
        'total', coalesce(sum(total), 0),
        'ocupadas', coalesce(sum(ocupadas), 0),
        'libres', coalesce(sum(libres), 0),
        'bonificadas', coalesce(sum(bonificadas), 0),
        'pct', case when coalesce(sum(total), 0) = 0 then null
                    else round(100.0 * sum(ocupadas) / sum(total), 1) end
      ) from por_tipo
    )
  );
$fn$;

comment on function public.reporte_ocupacion_dia(date) is
  'Ocupación de un día por tipo de unidad. Ocupada = unidad con reserva activa cuyo rango contiene la fecha, de cualquier tipo_alquiler (incluye preconfirmadas y bonificadas). Fuente única: la usan Reportes, el PDF, el push y el WhatsApp.';

grant execute on function public.reporte_ocupacion_dia(date) to authenticated;

-- ----------------------------------------------------------- fn_reporte_bloque
-- Bloque de números de un rango. Interna: reporte_resumen la llama dos veces
-- (período actual y anterior de igual duración) para no duplicar la lógica.
create or replace function public.fn_reporte_bloque(p_desde date, p_hasta date)
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
  with rango as (
    select greatest(p_desde, public.fn_caja_inicio()) as d1, p_hasta as d2
  ),
  cajas as (
    select c.* from caja_diaria c, rango
    where c.fecha between rango.d1 and rango.d2
  ),
  ing as (
    select p.id, p.monto, p.medio, p.moneda, p.monto_original, p.tipo_cambio_usado,
           p.comprobante_id, p.reserva_id, c.fecha as fecha_caja
    from pagos p join cajas c on c.id = p.caja_id
    where p.estado = 'vigente'
  ),
  egr as (
    select g.id, g.monto, g.tipo_comprobante, g.categoria, g.proveedor, g.descripcion,
           g.created_at, g.comprobante_proveedor, g.letra_factura,
           coalesce(cg.nombre, g.categoria) as categoria_nombre,
           c.fecha as fecha_caja
    from gastos_caja g
    join cajas c on c.id = g.caja_id
    left join categorias_gasto cg on cg.id = g.categoria_id
    where g.estado = 'vigente'
  ),
  dias as (
    select d::date as dia from rango, generate_series(rango.d1, rango.d2, interval '1 day') d
  ),
  ocup as (
    select dias.dia,
           (select count(*) from unidades)::int as total,
           (select count(*) from unidades u where exists (
              select 1 from reservas r
              where r.unidad_id = u.id and r.estado = 'activa' and r.rango @> dias.dia
           ))::int as ocupadas
    from dias
  ),
  tot_ing as (
    select coalesce(sum(monto), 0) as total, count(*)::int as cantidad,
           coalesce(sum(monto_original) filter (where moneda = 'USD'), 0) as usd_recibidos,
           coalesce(sum(monto) filter (where moneda = 'USD'), 0) as usd_en_pesos
    from ing
  ),
  tot_egr as (
    select coalesce(sum(monto), 0) as total,
           coalesce(sum(monto) filter (where tipo_comprobante = 'F'), 0) as total_f,
           coalesce(sum(monto) filter (where tipo_comprobante = 'SF'), 0) as total_sf,
           count(*)::int as cantidad
    from egr
  )
  select jsonb_build_object(
    'desde', (select d1 from rango),
    'hasta', (select d2 from rango),
    'dias', (select count(*)::int from dias),

    'ingresos', jsonb_build_object(
      'total', (select total from tot_ing),
      'cantidad', (select cantidad from tot_ing),
      -- Lo que entró literalmente en dólares, al tipo de cambio que quedó
      -- guardado en cada pago (nunca el de hoy), y su equivalente en pesos.
      'usd_recibidos', (select usd_recibidos from tot_ing),
      'usd_en_pesos', (select usd_en_pesos from tot_ing),
      'por_medio', coalesce((
        select jsonb_agg(jsonb_build_object('medio', medio, 'total', total, 'cantidad', cantidad) order by total desc)
        from (select medio, sum(monto) as total, count(*)::int as cantidad from ing group by medio) t
      ), '[]'::jsonb),
      'por_comprobante', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total, 'cantidad', cantidad) order by tipo)
        from (
          select case
                   when cm.tipo like 'factura%' then 'factura'
                   when cm.tipo like 'recibo%'  then 'recibo'
                   else 'sin_comprobante'
                 end as tipo,
                 sum(i.monto) as total, count(*)::int as cantidad
          from ing i left join comprobantes cm on cm.id = i.comprobante_id
          group by 1
        ) t
      ), '[]'::jsonb),
      'por_tipo_unidad', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total, 'cantidad', cantidad) order by total desc)
        from (
          select coalesce(u.tipo, 'sin_unidad') as tipo, sum(i.monto) as total, count(*)::int as cantidad
          from ing i
          left join reservas r on r.id = i.reserva_id
          left join unidades u on u.id = r.unidad_id
          group by 1
        ) t
      ), '[]'::jsonb),
      'por_tipo_alquiler', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total, 'cantidad', cantidad) order by total desc)
        from (
          select coalesce(r.tipo_alquiler, 'sin_reserva') as tipo, sum(i.monto) as total, count(*)::int as cantidad
          from ing i left join reservas r on r.id = i.reserva_id
          group by 1
        ) t
      ), '[]'::jsonb)
    ),

    'egresos', jsonb_build_object(
      'total', (select total from tot_egr),
      'total_f', (select total_f from tot_egr),
      'total_sf', (select total_sf from tot_egr),
      'cantidad', (select cantidad from tot_egr),
      -- null, no 0: sin egresos la UI dice "sin datos", no "0% sin factura".
      'pct_sf', (select case when total = 0 then null else round(100 * total_sf / total, 1) end from tot_egr),
      'ratio_sobre_ingresos', (
        select case when i.total = 0 then null else round(100 * e.total / i.total, 1) end
        from tot_ing i, tot_egr e
      ),
      'promedio_diario', (
        select case when d = 0 then 0 else round(e.total / d, 2) end
        from tot_egr e, (select count(*)::int as d from dias) x
      ),
      'por_categoria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'categoria', categoria, 'nombre', nombre, 'total', total,
          'total_f', total_f, 'total_sf', total_sf, 'cantidad', cantidad,
          'pct', case when (select total from tot_egr) = 0 then null
                      else round(100 * total / (select total from tot_egr), 1) end
        ) order by total desc)
        from (
          select categoria, categoria_nombre as nombre, sum(monto) as total,
                 coalesce(sum(monto) filter (where tipo_comprobante = 'F'), 0) as total_f,
                 coalesce(sum(monto) filter (where tipo_comprobante = 'SF'), 0) as total_sf,
                 count(*)::int as cantidad
          from egr group by categoria, categoria_nombre
        ) t
      ), '[]'::jsonb),
      'top_proveedores', coalesce((
        select jsonb_agg(jsonb_build_object('proveedor', proveedor, 'total', total, 'cantidad', cantidad) order by total desc)
        from (
          select proveedor, sum(monto) as total, count(*)::int as cantidad
          from egr where coalesce(trim(proveedor), '') <> ''
          group by proveedor order by sum(monto) desc limit 5
        ) t
      ), '[]'::jsonb),
      'mas_grandes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'gasto_id', id, 'fecha', fecha_caja, 'concepto', descripcion, 'monto', monto,
          'tipo_comprobante', tipo_comprobante, 'categoria', categoria_nombre, 'proveedor', proveedor,
          'numero_factura', comprobante_proveedor, 'letra_factura', letra_factura
        ) order by monto desc)
        from (select * from egr order by monto desc limit 10) t
      ), '[]'::jsonb)
    ),

    'neto', (select i.total - e.total from tot_ing i, tot_egr e),
    'ticket_promedio', (
      select case when cantidad = 0 then null else round(total / cantidad, 2) end from tot_ing
    ),

    'z', jsonb_build_object(
      'total', coalesce((select sum(z_total) from cajas where z_total is not null), 0),
      'cantidad', (select count(*)::int from cajas where z_numero is not null),
      'comprobantes', coalesce((select sum(z_cantidad_comprobantes) from cajas), 0)
    ),

    'cajas', jsonb_build_object(
      'total', (select count(*)::int from cajas),
      'cerradas', (select count(*)::int from cajas where estado = 'cerrada'),
      'abiertas', (select count(*)::int from cajas where estado = 'abierta'),
      'arqueo_pendiente', (select count(*)::int from cajas where arqueo_pendiente)
    ),

    'ocupacion', jsonb_build_object(
      'promedio_pct', (
        select case when sum(total) = 0 then null else round(100.0 * sum(ocupadas) / sum(total), 1) end from ocup
      ),
      'dia_pico', (
        select jsonb_build_object(
          'fecha', dia, 'ocupadas', ocupadas, 'total', total,
          'pct', case when total = 0 then null else round(100.0 * ocupadas / total, 1) end
        )
        from ocup order by ocupadas desc, dia limit 1
      )
    )
  );
$fn$;

comment on function public.fn_reporte_bloque(date, date) is
  'Bloque de números de un rango (ingresos, egresos F/SF, neto, Z, cajas, ocupación). Interna: la usa reporte_resumen para el período actual y el anterior. El flujo arranca en fn_caja_inicio() (1/10/2026): los pagos históricos anteriores no cuentan como flujo.';

grant execute on function public.fn_reporte_bloque(date, date) to authenticated;

-- ------------------------------------------------------------ reporte_resumen
create or replace function public.reporte_resumen(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_d1    date := greatest(p_desde, public.fn_caja_inicio());
  v_d2    date := p_hasta;
  v_dias  integer;
  v_prev1 date;
  v_prev2 date;
  v_act   jsonb;
  v_ant   jsonb;
  v_gran  text;
  v_serie jsonb;
  v_temp  jsonb;
  v_tid   uuid;
begin
  if v_d2 < v_d1 then v_d2 := v_d1; end if;
  v_dias := (v_d2 - v_d1) + 1;
  v_prev2 := v_d1 - 1;
  v_prev1 := v_prev2 - (v_dias - 1);

  v_act := public.fn_reporte_bloque(v_d1, v_d2);
  v_ant := public.fn_reporte_bloque(v_prev1, v_prev2);

  -- Granularidad de la serie según el largo del período: un mes se ve por
  -- día, medio año por semana, más que eso por mes.
  v_gran := case when v_dias <= 31 then 'dia' when v_dias <= 180 then 'semana' else 'mes' end;

  with dias as (
    select d::date as dia from generate_series(v_d1, v_d2, interval '1 day') d
  ),
  base as (
    select
      dias.dia,
      case v_gran
        when 'dia'    then dias.dia
        when 'semana' then date_trunc('week', dias.dia)::date
        else               date_trunc('month', dias.dia)::date
      end as bucket,
      coalesce((
        select sum(p.monto) from pagos p join caja_diaria c on c.id = p.caja_id
        where p.estado = 'vigente' and c.fecha = dias.dia
      ), 0) as ingresos,
      coalesce((
        select sum(g.monto) from gastos_caja g join caja_diaria c on c.id = g.caja_id
        where g.estado = 'vigente' and c.fecha = dias.dia and g.tipo_comprobante = 'F'
      ), 0) as egresos_f,
      coalesce((
        select sum(g.monto) from gastos_caja g join caja_diaria c on c.id = g.caja_id
        where g.estado = 'vigente' and c.fecha = dias.dia and g.tipo_comprobante = 'SF'
      ), 0) as egresos_sf,
      (select count(*) from unidades)::int as unidades_total,
      (select count(*) from unidades u where exists (
         select 1 from reservas r
         where r.unidad_id = u.id and r.estado = 'activa' and r.rango @> dias.dia
      ))::int as unidades_ocupadas
    from dias
  ),
  por_bucket as (
    select
      bucket,
      min(dia) as desde,
      max(dia) as hasta,
      sum(ingresos) as ingresos,
      sum(egresos_f) as egresos_f,
      sum(egresos_sf) as egresos_sf,
      sum(ingresos) - sum(egresos_f) - sum(egresos_sf) as neto,
      case when sum(unidades_total) = 0 then null
           else round(100.0 * sum(unidades_ocupadas) / sum(unidades_total), 1) end as ocupacion_pct
    from base group by bucket
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', bucket, 'desde', desde, 'hasta', hasta,
    'ingresos', ingresos, 'egresos_f', egresos_f, 'egresos_sf', egresos_sf,
    'egresos', egresos_f + egresos_sf, 'neto', neto, 'ocupacion_pct', ocupacion_pct
  ) order by bucket), '[]'::jsonb) into v_serie from por_bucket;

  -- Temporada: lo comprometido es la suma de las reservas activas no
  -- bonificadas de la temporada vigente; lo cobrado incluye los pagos
  -- históricos (anteriores al 1/10/2026), que no cuentan como flujo pero sí
  -- como plata ya cobrada de la temporada.
  select id into v_tid from temporadas where estado = 'activa' order by fecha_inicio desc limit 1;

  select jsonb_build_object(
    'temporada_id', v_tid,
    'nombre', (select nombre from temporadas where id = v_tid),
    'comprometido', coalesce(comprometido, 0),
    'cobrado', coalesce(cobrado, 0),
    'por_cobrar', greatest(coalesce(comprometido, 0) - coalesce(cobrado, 0), 0),
    'pct_cobrado', case when coalesce(comprometido, 0) = 0 then null
                        else round(100 * coalesce(cobrado, 0) / comprometido, 1) end,
    'reservas', coalesce(cantidad, 0),
    'bonificadas', coalesce(bonificadas, 0)
  ) into v_temp
  from (
    select
      sum(r.valor_total) filter (where not r.bonificada) as comprometido,
      count(*) filter (where not r.bonificada)::int as cantidad,
      count(*) filter (where r.bonificada)::int as bonificadas,
      (select coalesce(sum(p.monto), 0) from pagos p
        where p.estado = 'vigente'
          and p.reserva_id in (
            select r2.id from reservas r2
            where r2.estado = 'activa' and not r2.bonificada
              and (v_tid is null or r2.temporada_id = v_tid)
          )) as cobrado
    from reservas r
    where r.estado = 'activa' and (v_tid is null or r.temporada_id = v_tid)
  ) t;

  return jsonb_build_object(
    'granularidad', v_gran,
    'periodo', jsonb_build_object('desde', v_d1, 'hasta', v_d2, 'dias', v_dias),
    'periodo_anterior', jsonb_build_object('desde', v_prev1, 'hasta', v_prev2),
    'actual', v_act,
    'anterior', v_ant,
    'deltas', jsonb_build_object(
      'ingresos',   public.fn_delta_pct((v_act->'ingresos'->>'total')::numeric, (v_ant->'ingresos'->>'total')::numeric),
      'egresos',    public.fn_delta_pct((v_act->'egresos'->>'total')::numeric,  (v_ant->'egresos'->>'total')::numeric),
      'egresos_f',  public.fn_delta_pct((v_act->'egresos'->>'total_f')::numeric,(v_ant->'egresos'->>'total_f')::numeric),
      'egresos_sf', public.fn_delta_pct((v_act->'egresos'->>'total_sf')::numeric,(v_ant->'egresos'->>'total_sf')::numeric),
      'neto',       public.fn_delta_pct((v_act->>'neto')::numeric,              (v_ant->>'neto')::numeric),
      'ticket_promedio', public.fn_delta_pct((v_act->>'ticket_promedio')::numeric, (v_ant->>'ticket_promedio')::numeric),
      'ocupacion', public.fn_delta_pct((v_act->'ocupacion'->>'promedio_pct')::numeric, (v_ant->'ocupacion'->>'promedio_pct')::numeric)
    ),
    'serie', v_serie,
    'temporada', v_temp
  );
end;
$fn$;

comment on function public.reporte_resumen(date, date) is
  'Fuente única de números de Reportes, del PDF, del push y del WhatsApp. Devuelve el bloque del período, el del período anterior de igual duración, los deltas (null si no hay con qué comparar), la serie agrupada por día/semana/mes según el largo del período, y el estado de la temporada. El flujo arranca el 1/10/2026 (fn_caja_inicio); los pagos anteriores cuentan solo en el cobrado de la temporada.';

grant execute on function public.reporte_resumen(date, date) to authenticated;

-- ------------------------------------------------------- resumen_cierre_caja
create or replace function public.resumen_cierre_caja(p_caja_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_caja      caja_diaria;
  v_res       jsonb;
  v_ocup      jsonb;
  v_mes       jsonb;
  v_sem_ant   jsonb;
  v_temp      jsonb;
  v_quien     text;
begin
  select * into v_caja from caja_diaria where id = p_caja_id;
  if not found then raise exception 'Caja no encontrada.'; end if;

  -- El detalle del día sale de resumen_caja (fuente única del cierre: la
  -- pantalla, la impresión A4 y el CSV leen ese mismo objeto).
  v_res  := public.resumen_caja(p_caja_id);
  v_ocup := public.reporte_ocupacion_dia(v_caja.fecha);

  -- Acumulado del mes: desde el 1° del mes de la caja hasta la fecha de la caja.
  v_mes := public.fn_reporte_bloque(date_trunc('month', v_caja.fecha)::date, v_caja.fecha);

  -- Mismo día de la semana, semana anterior: es la comparación que sirve en
  -- un balneario (un sábado contra un sábado, no contra un martes).
  v_sem_ant := (
    select jsonb_build_object(
      'fecha', c.fecha,
      'ingresos', coalesce((select sum(p.monto) from pagos p where p.caja_id = c.id and p.estado = 'vigente'), 0),
      'egresos',  coalesce((select sum(g.monto) from gastos_caja g where g.caja_id = c.id and g.estado = 'vigente'), 0),
      'ocupacion_pct', (public.reporte_ocupacion_dia(c.fecha)->'total'->>'pct')::numeric
    )
    from caja_diaria c where c.fecha = v_caja.fecha - 7
  );

  -- Temporada vigente: comprometido / cobrado / por cobrar. Sale del mismo
  -- cálculo que Reportes (reporte_resumen), no de una suma propia.
  v_temp := public.reporte_resumen(v_caja.fecha, v_caja.fecha)->'temporada';

  -- "Nombre Apellido a las HH:MM" o "cierre automático" — es la variable 10
  -- de la plantilla de WhatsApp, en una sola línea y sin saltos.
  if v_caja.cierre_automatico or v_caja.cerrada_por is null then
    v_quien := 'cierre automático';
  else
    v_quien := coalesce(
      (select nombre from perfiles where user_id = v_caja.cerrada_por), 'alguien'
    ) || ' a las ' || to_char(v_caja.cerrada_at at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI');
  end if;

  return jsonb_build_object(
    'caja_id', v_caja.id,
    'fecha', v_caja.fecha,
    'estado', v_caja.estado,
    'cierre', jsonb_build_object(
      'automatico', v_caja.cierre_automatico,
      'arqueo_pendiente', v_caja.arqueo_pendiente,
      'cerrada_at', v_caja.cerrada_at,
      'cerrada_por', v_caja.cerrada_por,
      'cerrada_por_nombre', (select nombre from perfiles where user_id = v_caja.cerrada_por),
      'hora', case when v_caja.cerrada_at is null then null
                   else to_char(v_caja.cerrada_at at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') end,
      'quien', v_quien
    ),
    'ingresos', jsonb_build_object(
      'total', v_res->'totales'->'ingresos',
      'por_medio', v_res->'por_medio',
      'facturas', v_res->'facturas',
      'recibos', v_res->'recibos',
      'sin_comprobante', v_res->'sin_comprobante'
    ),
    'egresos', v_res->'gastos',
    'arqueo', v_res->'arqueo',
    'z', v_res->'z',
    'neto', v_res->'totales'->'neto',
    'total_dia', jsonb_build_object(
      'ingresos', v_res->'totales'->'ingresos',
      'z', v_res->'z'->'total'
    ),
    'ocupacion', v_ocup,
    'acumulado_mes', jsonb_build_object(
      'desde', v_mes->'desde',
      'hasta', v_mes->'hasta',
      'ingresos', v_mes->'ingresos'->'total',
      'egresos', v_mes->'egresos'->'total',
      'egresos_f', v_mes->'egresos'->'total_f',
      'egresos_sf', v_mes->'egresos'->'total_sf',
      'neto', v_mes->'neto'
    ),
    'temporada', v_temp,
    -- null cuando no hay caja ese día: la UI y el mensaje dicen "sin datos
    -- para comparar", nunca un 0%.
    'semana_anterior', v_sem_ant,
    'deltas', jsonb_build_object(
      'ingresos_vs_semana_anterior', public.fn_delta_pct(
        (v_res->'totales'->>'ingresos')::numeric, (v_sem_ant->>'ingresos')::numeric
      ),
      'ocupacion_vs_semana_anterior', public.fn_delta_pct(
        (v_ocup->'total'->>'pct')::numeric, (v_sem_ant->>'ocupacion_pct')::numeric
      )
    )
  );
end;
$fn$;

comment on function public.resumen_cierre_caja(uuid) is
  'Resumen de una caja cerrada para el aviso de WhatsApp, el push, el PDF y la vista /caja/:fecha/resumen. Fuente única: compone resumen_caja, reporte_ocupacion_dia y fn_reporte_bloque; no suma nada por su cuenta.';

grant execute on function public.resumen_cierre_caja(uuid) to authenticated;

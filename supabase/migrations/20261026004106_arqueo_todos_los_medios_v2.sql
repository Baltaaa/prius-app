-- Item 1 (25/10/2026, pedido anterior que no quedó completo): el arqueo
-- solo cubría efectivo. Ahora integra TODOS los medios de pago con
-- movimiento ese día: Esperado (ingresos - egresos de ese medio, ya lo
-- traía `por_medio` como `neto`), Contado/Verificado y Diferencia, más una
-- fila Total. Un solo lugar (resumen_caja) para pantalla, impresión A4 y
-- CSV — ninguno recalcula por su cuenta.
--
-- `caja_diaria.contado_por_medio` (jsonb, aditivo): lo que el cajero
-- confirmó en el modal de cierre para CADA medio con movimiento —
-- `{"efectivo": 1500000, "tarjeta_credito": 3600000}`. Para cajas ya
-- cerradas ANTES de esta migración (columna null): efectivo usa el
-- `efectivo_contado` histórico que ya existía (no se toca ese dato), los
-- demás medios se muestran con contado = esperado, marcados
-- `declarado: false` ("no declarado") — nunca se inventa un número.

alter table public.caja_diaria add column if not exists contado_por_medio jsonb;
comment on column public.caja_diaria.contado_por_medio is 'Monto contado/verificado por medio de pago al cerrar la caja — ver resumen_caja().arqueo. Null = caja sin cerrar o cerrada antes del ítem 1 (25/10/2026).';

-- cerrar_caja: nuevo parámetro opcional p_contado_por_medio. Sigue
-- recibiendo p_efectivo_contado (compatibilidad con cualquier llamado
-- viejo) y sigue escribiendo efectivo_esperado/efectivo_contado/diferencia
-- tal cual siempre — el jsonb es aditivo, no reemplaza esas columnas. La
-- validación de "diferencia exige observaciones" ahora suma la diferencia
-- de TODOS los medios, no solo efectivo.
create or replace function public.cerrar_caja(
  p_caja_id uuid,
  p_efectivo_contado numeric,
  p_datos_z jsonb default null,
  p_observaciones text default null,
  p_contado_por_medio jsonb default null
)
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
  v_contado_map jsonb;
  v_diferencia_total numeric;
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

  -- Mapa final por medio: arranca de lo que mandó el cliente, asegura que
  -- 'efectivo' siempre quede alineado con p_efectivo_contado (fuente única
  -- para ese medio, igual que antes), y completa con el esperado cualquier
  -- medio con movimiento que no haya venido en el payload (defensivo — el
  -- front siempre debería mandarlos todos).
  v_contado_map := coalesce(p_contado_por_medio, '{}'::jsonb) || jsonb_build_object('efectivo', coalesce(p_efectivo_contado, 0));

  select v_contado_map || coalesce(jsonb_object_agg(t.medio, t.esperado) filter (where not (v_contado_map ? t.medio)), '{}'::jsonb)
  into v_contado_map
  from (
    select medio, sum(ingresos) - sum(egresos) as esperado from (
      select medio, monto as ingresos, 0 as egresos from pagos where caja_id = p_caja_id and estado = 'vigente'
      union all
      select medio_pago as medio, 0, monto from gastos_caja where caja_id = p_caja_id and estado = 'vigente'
    ) x group by medio
  ) t;

  select coalesce(sum((value::numeric) - esperado_medio.esperado), 0) into v_diferencia_total
  from jsonb_each_text(v_contado_map) kv(medio, value)
  join (
    select medio, sum(ingresos) - sum(egresos) as esperado from (
      select medio, monto as ingresos, 0 as egresos from pagos where caja_id = p_caja_id and estado = 'vigente'
      union all
      select medio_pago as medio, 0, monto from gastos_caja where caja_id = p_caja_id and estado = 'vigente'
    ) x group by medio
  ) esperado_medio on esperado_medio.medio = kv.medio;

  if v_diferencia_total <> 0 and (p_observaciones is null or btrim(p_observaciones) = '') then
    raise exception 'Hay diferencia de arqueo ($%): las observaciones son obligatorias.', v_diferencia_total;
  end if;

  update caja_diaria set
    estado = 'cerrada',
    cerrada_por = auth.uid(),
    cerrada_at = now(),
    efectivo_esperado = v_esperado,
    efectivo_contado = p_efectivo_contado,
    diferencia = v_diferencia,
    contado_por_medio = v_contado_map,
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
  values (p_caja_id, 'cierre', jsonb_build_object('efectivo_contado', p_efectivo_contado, 'diferencia', v_diferencia, 'contado_por_medio', v_contado_map, 'diferencia_total', v_diferencia_total), auth.uid());

  return v_caja;
end;
$function$;

-- resumen_caja: agrega `arqueo.por_medio` (esperado/contado/diferencia/
-- declarado por cada medio con movimiento) y `arqueo.total`. Reemplaza el
-- viejo `arqueo` (solo efectivo: inicial/esperado/contado/diferencia) —
-- los 3 consumidores (ResumenCaja.jsx, CajaImpresion.jsx, cajaCsv.ts) se
-- actualizan en el mismo ítem para leer la forma nueva.
create or replace function public.resumen_caja(p_caja_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_caja caja_diaria;
  v_result jsonb;
  v_por_medio jsonb;
  v_arqueo_por_medio jsonb;
  v_arqueo_total jsonb;
  v_abierta boolean;
begin
  select * into v_caja from caja_diaria where id = p_caja_id;
  if not found then raise exception 'Caja no encontrada.'; end if;
  v_abierta := (v_caja.estado = 'abierta');

  select coalesce(jsonb_agg(t order by t.medio), '[]'::jsonb) into v_por_medio from (
    select medio, count(*) as cantidad, sum(ingresos) as ingresos, sum(egresos) as egresos, sum(ingresos) - sum(egresos) as neto from (
      select medio, monto as ingresos, 0 as egresos from pagos where caja_id = p_caja_id and estado = 'vigente'
      union all
      select medio_pago as medio, 0, monto from gastos_caja where caja_id = p_caja_id and estado = 'vigente'
    ) x group by medio
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
      'medio', e->>'medio',
      'cantidad', (e->>'cantidad')::int,
      'ingresos', (e->>'ingresos')::numeric,
      'egresos', (e->>'egresos')::numeric,
      'esperado', (e->>'neto')::numeric,
      'contado', case
        when v_abierta then null
        when v_caja.contado_por_medio ? (e->>'medio') then (v_caja.contado_por_medio->>(e->>'medio'))::numeric
        when e->>'medio' = 'efectivo' and v_caja.efectivo_contado is not null then v_caja.efectivo_contado
        else (e->>'neto')::numeric
      end,
      'declarado', case
        when v_abierta then false
        when v_caja.contado_por_medio ? (e->>'medio') then true
        when e->>'medio' = 'efectivo' and v_caja.efectivo_contado is not null then true
        else false
      end
    ) order by e->>'medio'), '[]'::jsonb)
  into v_arqueo_por_medio
  from jsonb_array_elements(v_por_medio) e;

  select jsonb_build_object(
    'esperado', coalesce(sum((m->>'esperado')::numeric), 0),
    'contado', case when v_abierta then null else coalesce(sum((m->>'contado')::numeric), 0) end,
    'diferencia', case when v_abierta then null else coalesce(sum((m->>'contado')::numeric), 0) - coalesce(sum((m->>'esperado')::numeric), 0) end
  ) into v_arqueo_total
  from jsonb_array_elements(v_arqueo_por_medio) m;

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
             - coalesce((select sum(monto) from gastos_caja where caja_id = p_caja_id and estado = 'vigente'), 0),
      'cantidad', coalesce((select count(*) from pagos where caja_id = p_caja_id and estado = 'vigente'), 0)
                + coalesce((select count(*) from gastos_caja where caja_id = p_caja_id and estado = 'vigente'), 0)
    ),
    'por_medio', v_por_medio,
    'arqueo', jsonb_build_object('por_medio', v_arqueo_por_medio, 'total', v_arqueo_total),
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

-- Regenera el resumen_snapshot de todas las cajas YA cerradas con la
-- versión nueva de resumen_caja — arregla de una el bug reportado del
-- 14/10/2026 (arqueo solo efectivo, MOVIMIENTOS "—" y CANTIDAD vacía en la
-- impresión A4 porque el snapshot había quedado congelado con una versión
-- vieja de la función). No toca pagos/gastos/comprobantes, solo
-- recalcula una columna derivada.
--
-- Excluye 9 cajas históricas (jul-sep 2026) cuyo `saldo_apertura` ya venía
-- fuera de rango (-200000/-300000) desde antes de este ítem — el check
-- `caja_diaria_saldo_apertura_max_check` es NOT VALID (no valida filas
-- viejas), pero SÍ revalida cualquier fila tocada por un UPDATE nuevo, así
-- que un UPDATE a esas 9 filas rechaza aunque no toquemos esa columna.
-- No se les toca el dato: quedan con el snapshot viejo hasta que alguien
-- decida si corresponde corregir `saldo_apertura` a 0 (regla "la caja
-- arranca siempre en $0") — reportado aparte, no corregido acá.
update caja_diaria set resumen_snapshot = resumen_caja(id)
where estado = 'cerrada' and (saldo_apertura is null or (saldo_apertura >= 0 and saldo_apertura <= 10000000));

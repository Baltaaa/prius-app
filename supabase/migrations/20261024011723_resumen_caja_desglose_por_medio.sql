-- Fix urgente 24/10/2026, item 2: el arqueo/resumen de caja solo exponía el
-- total de efectivo (correcto para "arqueo" en el sentido estricto — contar
-- billetes físicos solo tiene sentido para efectivo) pero no un desglose
-- completo por medio de pago con CANTIDAD de movimientos, que es lo que
-- pantalla/impresión/CSV necesitan mostrar. `por_medio` ya traía
-- ingresos/egresos/neto por medio — se agrega `cantidad` (count de
-- movimientos, pagos + gastos). `totales` suma `cantidad` general. Un solo
-- lugar (resumen_caja) para que pantalla, impresión A4 y CSV lean
-- exactamente lo mismo — ningún front recalcula esto por su cuenta.
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
             - coalesce((select sum(monto) from gastos_caja where caja_id = p_caja_id and estado = 'vigente'), 0),
      'cantidad', coalesce((select count(*) from pagos where caja_id = p_caja_id and estado = 'vigente'), 0)
                + coalesce((select count(*) from gastos_caja where caja_id = p_caja_id and estado = 'vigente'), 0)
    ),
    'por_medio', (
      select coalesce(jsonb_agg(t order by t.medio), '[]'::jsonb) from (
        select medio, count(*) as cantidad, sum(ingresos) as ingresos, sum(egresos) as egresos, sum(ingresos) - sum(egresos) as neto from (
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

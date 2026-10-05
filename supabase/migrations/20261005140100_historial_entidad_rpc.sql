-- RPC única de lectura para el componente Historial (ítem 2): resuelve
-- server-side qué eventos pertenecen a un cliente/reserva/unidad (hace los
-- joins necesarios, ej. comprobante → pago → reserva → unidad) y pagina por
-- cursor (ts) para la carga incremental. Nada de esto escribe — solo lee
-- `eventos`, que ya tiene RLS de solo-lectura para authenticated.
create or replace function public.historial_entidad(
  p_tipo text,
  p_id uuid default null,
  p_cursor timestamptz default null,
  p_limit integer default 20,
  p_tipos_evento text[] default null
)
returns setof eventos
language sql
security definer
set search_path = public, pg_temp
as $$
  select e.*
  from eventos e
  where
    (p_tipos_evento is null or e.tipo_evento = any(p_tipos_evento))
    and (p_cursor is null or e.ts < p_cursor)
    and (
      p_tipo = 'global'
      or (p_tipo = 'cliente' and (
        (e.tabla = 'clientes' and e.registro_id = p_id)
        or (e.tabla in ('reservas', 'pagos', 'comprobantes') and (
          (e.datos->'after'->>'cliente_id')::uuid = p_id
          or (e.datos->'before'->>'cliente_id')::uuid = p_id
        ))
      ))
      or (p_tipo = 'reserva' and (
        (e.tabla = 'reservas' and e.registro_id = p_id)
        or (e.tabla = 'pagos' and (
          (e.datos->'after'->>'reserva_id')::uuid = p_id
          or (e.datos->'before'->>'reserva_id')::uuid = p_id
        ))
        or (e.tabla = 'comprobantes' and exists (
          select 1 from pagos pg
          where pg.id = coalesce((e.datos->'after'->>'pago_id')::uuid, (e.datos->'before'->>'pago_id')::uuid)
          and pg.reserva_id = p_id
        ))
      ))
      or (p_tipo = 'unidad' and (
        (e.tabla = 'unidades' and e.registro_id = p_id)
        or (e.tabla = 'reservas' and (
          (e.datos->'after'->>'unidad_id')::uuid = p_id
          or (e.datos->'before'->>'unidad_id')::uuid = p_id
        ))
        or (e.tabla = 'pagos' and exists (
          select 1 from reservas r
          where r.unidad_id = p_id
          and r.id = coalesce((e.datos->'after'->>'reserva_id')::uuid, (e.datos->'before'->>'reserva_id')::uuid)
        ))
        or (e.tabla = 'comprobantes' and exists (
          select 1 from pagos pg join reservas r on r.id = pg.reserva_id
          where pg.id = coalesce((e.datos->'after'->>'pago_id')::uuid, (e.datos->'before'->>'pago_id')::uuid)
          and r.unidad_id = p_id
        ))
      ))
    )
  order by e.fecha_ref desc, e.ts desc
  limit coalesce(p_limit, 20);
$$;

revoke all on function public.historial_entidad(text, uuid, timestamptz, integer, text[]) from public, anon;
grant execute on function public.historial_entidad(text, uuid, timestamptz, integer, text[]) to authenticated;

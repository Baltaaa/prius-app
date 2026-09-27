create extension if not exists btree_gist;

-- Periodo/dia: exclusion constraint con rango de fechas real por fila.
-- Solo aplica a reservas activas (cancelada no ocupa la unidad).
alter table public.reservas
  add constraint reservas_no_overlap_periodo_dia
  exclude using gist (
    unidad_id with =,
    (case tipo_alquiler
       when 'dia' then daterange(fecha, fecha, '[]')
       when 'periodo' then daterange(fecha_inicio, fecha_fin, '[]')
     end) with &&
  )
  where (estado = 'activa' and tipo_alquiler in ('dia', 'periodo'));

-- Temporada: no tiene fecha propia (vive en temporadas.fecha_inicio/fecha_fin),
-- se asume que ocupa toda la temporada activa referenciada por temporada_id.
-- Evita dos reservas activas de la misma unidad para la misma temporada.
create unique index reservas_temporada_unica_por_unidad
  on public.reservas (unidad_id, temporada_id)
  where (estado = 'activa' and tipo_alquiler = 'temporada');

-- Egresos F / SF + categorías administrables (nov 2026, Tarea 1).
--
-- Antes: gastos_caja.categoria era un text con CHECK de 8 slugs fijos y el
-- único rastro de factura era `comprobante_proveedor` (texto libre, siempre
-- vacío en producción). No había forma de separar el gasto con factura del
-- gasto sin factura, que es justo lo que el dueño necesita para la contadora.
--
-- Ahora:
--   * tipo_comprobante F / SF obligatorio.
--   * categorias_gasto como tabla administrable (se desactivan, no se borran).
--   * gastos_caja.categoria_id es la verdad; `categoria` queda como slug
--     denormalizado que mantiene un trigger, para que resumen_caja, el CSV,
--     la impresión A4 y las etiquetas del front sigan funcionando sin tocar
--     nada más (una sola escritura, varias lecturas).
--   * `comprobante_proveedor` ES el número de factura (ya existía: no se
--     duplica la columna); se suma solo `letra_factura`.

-- ---------------------------------------------------------------- categorías
create table if not exists public.categorias_gasto (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  nombre     text not null unique,
  orden      integer not null default 100,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.categorias_gasto is
  'Categorías de egreso de caja. Administrables por superadmin; se desactivan, nunca se borran. `slug` es la clave estable que guarda gastos_caja.categoria.';

-- Seed con los nombres que pidió el dueño. Los slugs que ya existían en el
-- CHECK viejo se reusan tal cual para no perder la categoría de ningún gasto
-- histórico; `insumos` se absorbe en "Limpieza e insumos" (ver más abajo).
insert into public.categorias_gasto (slug, nombre, orden) values
  ('proveedores',       'Proveedores y mercadería',                10),
  ('sueldos_adelantos', 'Sueldos y personal',                      20),
  ('mantenimiento',     'Mantenimiento y reparaciones',            30),
  ('servicios',         'Servicios (luz, agua, gas, internet)',    40),
  ('limpieza',          'Limpieza e insumos',                      50),
  ('gastronomia',       'Gastronomía',                             60),
  ('impuestos',         'Impuestos y tasas',                       70),
  ('publicidad',        'Publicidad',                              80),
  ('retiro_dueno',      'Retiros del dueño',                       90),
  ('otros',             'Otros',                                  100)
on conflict (slug) do nothing;

alter table public.categorias_gasto enable row level security;

drop policy if exists auth_select_categorias_gasto on public.categorias_gasto;
create policy auth_select_categorias_gasto on public.categorias_gasto
  for select using (public.usuario_activo());

-- ------------------------------------------------------------- gastos_caja
alter table public.gastos_caja
  add column if not exists tipo_comprobante text,
  add column if not exists letra_factura    text,
  add column if not exists categoria_id     uuid references public.categorias_gasto(id);

comment on column public.gastos_caja.tipo_comprobante is 'F = con factura, SF = sin factura. Obligatorio.';
comment on column public.gastos_caja.comprobante_proveedor is 'Número de factura del proveedor (solo tiene sentido con tipo_comprobante = F).';
comment on column public.gastos_caja.letra_factura is 'Letra de la factura del proveedor: A, B o C.';

-- Hay un gasto histórico con monto 0 que viola `gastos_caja_monto_positivo_check`
-- (es NOT VALID justamente por eso). Cualquier UPDATE sobre esa fila la haría
-- revalidar y abortaría el backfill, así que el CHECK se saca y se vuelve a
-- poner NOT VALID al terminar. No se corrige ningún dato histórico.
alter table public.gastos_caja drop constraint if exists gastos_caja_monto_positivo_check;
-- Y el backfill no cambia ningún monto, así que el recálculo de totales no
-- aporta nada y además arrastraría a caja_diaria, que tiene otro CHECK NOT
-- VALID violado por una caja de la migración histórica. Se apaga también el
-- log para no inundar el Historial con 8 "gasto editado" de la migración.
alter table public.gastos_caja disable trigger trg_gasto_recalcula_caja;
alter table public.gastos_caja disable trigger trg_zzz_log_evento;

-- Backfill: F si ya había un número de comprobante cargado, SF si no.
update public.gastos_caja
   set tipo_comprobante = case
         when coalesce(trim(comprobante_proveedor), '') <> '' then 'F'
         else 'SF'
       end
 where tipo_comprobante is null;

-- `insumos` ya no es una categoría propia: pasa a "Limpieza e insumos".
update public.gastos_caja set categoria = 'limpieza' where categoria = 'insumos';

update public.gastos_caja g
   set categoria_id = c.id
  from public.categorias_gasto c
 where g.categoria_id is null
   and c.slug = coalesce(nullif(g.categoria, ''), 'otros');

-- Lo que no matcheó con ningún slug conocido cae en "Otros".
update public.gastos_caja g
   set categoria_id = (select id from public.categorias_gasto where slug = 'otros')
 where g.categoria_id is null;

alter table public.gastos_caja enable trigger trg_gasto_recalcula_caja;
alter table public.gastos_caja enable trigger trg_zzz_log_evento;

alter table public.gastos_caja
  alter column tipo_comprobante set not null,
  alter column categoria_id     set not null;

alter table public.gastos_caja
  add constraint gastos_caja_monto_positivo_check check (monto > 0) not valid;

-- El CHECK viejo de `categoria` fijaba los 8 slugs: con categorías
-- administrables ya no sirve, la integridad la da la FK de categoria_id.
alter table public.gastos_caja drop constraint if exists gastos_caja_categoria_check;

alter table public.gastos_caja drop constraint if exists gastos_caja_tipo_comprobante_check;
alter table public.gastos_caja
  add constraint gastos_caja_tipo_comprobante_check
  check (tipo_comprobante in ('F', 'SF'));

alter table public.gastos_caja drop constraint if exists gastos_caja_letra_factura_check;
alter table public.gastos_caja
  add constraint gastos_caja_letra_factura_check
  check (letra_factura is null or letra_factura in ('A', 'B', 'C'));

-- `categoria` (slug) queda derivado de categoria_id: una sola verdad, y todo
-- lo que ya leía el slug (resumen_caja, CSV, impresión, labels del front)
-- sigue andando sin cambios.
create or replace function public.fn_gasto_sincroniza_categoria()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  select slug into new.categoria from categorias_gasto where id = new.categoria_id;
  if new.categoria is null then
    raise exception 'Categoría de gasto inexistente.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gasto_sincroniza_categoria on public.gastos_caja;
create trigger trg_gasto_sincroniza_categoria
  before insert or update of categoria_id on public.gastos_caja
  for each row execute function public.fn_gasto_sincroniza_categoria();

create index if not exists idx_gastos_caja_caja          on public.gastos_caja (caja_id);
create index if not exists idx_gastos_caja_tipo_compr    on public.gastos_caja (tipo_comprobante);
create index if not exists idx_gastos_caja_categoria_id  on public.gastos_caja (categoria_id);
create index if not exists idx_gastos_caja_estado_caja   on public.gastos_caja (estado, caja_id);

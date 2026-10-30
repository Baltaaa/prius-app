-- Punto 4 (30/10/2026), PRIMERA ETAPA. Aplicada en producción vía MCP.
-- El peso sigue siendo la moneda principal y la fuente de verdad de caja y
-- reportes; esto solo agrega la infraestructura para cotizar y para registrar
-- un pago hecho en dólares.

create table if not exists public.tipos_cambio (
  fecha date not null,
  tipo text not null,
  compra numeric(14,4),
  venta numeric(14,4),
  fuente text not null default 'dolarapi',
  updated_at timestamptz not null default now(),
  primary key (fecha, tipo),
  constraint tipos_cambio_tipo_chk check (tipo in ('oficial', 'blue'))
);
comment on table public.tipos_cambio is
  'Cotización diaria del dólar (DolarApi), cacheada por la Edge Function `tipo-cambio`. Si la API falla se usa la última fila guardada.';

alter table public.tipos_cambio enable row level security;
drop policy if exists tipos_cambio_select on public.tipos_cambio;
create policy tipos_cambio_select on public.tipos_cambio
  for select to authenticated using (true);

create table if not exists public.config_tipo_cambio (
  id boolean primary key default true,
  tipo text not null default 'oficial',
  lado text not null default 'venta',
  updated_at timestamptz not null default now(),
  constraint config_tipo_cambio_single check (id),
  constraint config_tipo_cambio_tipo_chk check (tipo in ('oficial', 'blue')),
  constraint config_tipo_cambio_lado_chk check (lado in ('compra', 'venta'))
);
insert into public.config_tipo_cambio (id) values (true) on conflict (id) do nothing;

alter table public.config_tipo_cambio enable row level security;
drop policy if exists config_tipo_cambio_select on public.config_tipo_cambio;
create policy config_tipo_cambio_select on public.config_tipo_cambio
  for select to authenticated using (true);
drop policy if exists config_tipo_cambio_update on public.config_tipo_cambio;
create policy config_tipo_cambio_update on public.config_tipo_cambio
  for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

alter publication supabase_realtime add table public.tipos_cambio;
alter publication supabase_realtime add table public.config_tipo_cambio;

-- `pagos.monto` SIGUE SIENDO el monto en pesos que ya usan saldos, triggers
-- de caja y reportes: no se migra ni se reinterpreta. Un pago en USD guarda
-- el equivalente en pesos en `monto` y el original en `monto_original` +
-- `tipo_cambio_usado`. `monto_ars` es una columna GENERADA espejo de `monto`
-- (nombre explícito para reportes multi-moneda, sin crear una segunda fuente
-- de verdad que pueda desincronizarse).
alter table public.pagos
  add column if not exists moneda text not null default 'ARS',
  add column if not exists monto_original numeric(14,2),
  add column if not exists tipo_cambio_usado numeric(14,4);

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_name='pagos' and column_name='monto_ars') then
    alter table public.pagos add column monto_ars numeric generated always as (monto) stored;
  end if;
  if not exists (select 1 from pg_constraint where conname='pagos_moneda_chk') then
    alter table public.pagos add constraint pagos_moneda_chk
      check (moneda in ('ARS','USD')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='pagos_usd_completo_chk') then
    alter table public.pagos add constraint pagos_usd_completo_chk check (
      moneda <> 'USD'
      or (monto_original is not null and tipo_cambio_usado is not null and tipo_cambio_usado > 0)
    ) not valid;
  end if;
end $$;

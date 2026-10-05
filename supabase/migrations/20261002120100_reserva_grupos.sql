-- Reservas con precio unificado (oct 2026): un cliente puede tener varias
-- reservas de período/temporada bajo UN SOLO precio pactado (caso Ana
-- Lescano: 3 períodos de carpa 74, $3.100.000 totales, un solo comprobante).
-- No se toca `monto_grupo_referencia` (campo legado de la migración del
-- excel, quedó como dato de referencia histórico, no se usa en ningún
-- cálculo) — el grupo es la fuente de verdad desde ahora para cualquier
-- reserva agrupada.
--
-- Diseño deliberadamente simple: NO se agrega grupo_id a `pagos`. Un pago
-- sigue registrándose contra una reserva puntual (reserva_id, sin cambios en
-- RegistrarPago/completar_comprobante/registrar_pago). El saldo/estado de
-- grupo se calcula en el front sumando los pagos de TODAS las reservas que
-- comparten `grupo_id` (ver src/lib/reservas.js) — mismo patrón de lectura
-- derivada que ya usa saldoNumerico() para temporada migrada, sin inventar
-- un segundo camino de escritura de dinero.
create table reserva_grupos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  temporada text,
  precio_total numeric not null check (precio_total >= 0 and precio_total = round(precio_total)),
  notas text,
  created_at timestamptz not null default now()
);

alter table reservas add column grupo_id uuid references reserva_grupos(id);
create index idx_reservas_grupo_id on reservas(grupo_id);

alter table reserva_grupos enable row level security;
create policy auth_all_reserva_grupos on reserva_grupos for all using (usuario_activo()) with check (usuario_activo());

grant select, insert, update, delete on reserva_grupos to authenticated;

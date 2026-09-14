-- Deja la estructura lista para distinguir reservas cargadas a mano (CRM)
-- de las que en el futuro entren por el sistema de reservas públicas con QR
-- (todavía en planificación, no implementado). Hoy todas son 'manual'.
alter table public.reservas
  add column if not exists origen text not null default 'manual';

alter table public.reservas
  drop constraint if exists reservas_origen_check;

alter table public.reservas
  add constraint reservas_origen_check
  check (origen = any (array['manual','web']));

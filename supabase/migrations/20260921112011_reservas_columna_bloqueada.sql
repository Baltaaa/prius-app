alter table public.reservas
  add column bloqueada boolean not null default false;

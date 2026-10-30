-- Punto 8 (30/10/2026): check-in por QR desde el celular reflejado al
-- instante en la compu. Aplicada en producción vía MCP el 30/10/2026.
create table if not exists public.recepcion_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reserva_id uuid references public.reservas(id) on delete cascade,
  codigo text,
  tipo text not null default 'qr_scan',
  created_at timestamptz not null default now(),
  constraint recepcion_eventos_tipo_chk check (tipo in ('qr_scan'))
);

comment on table public.recepcion_eventos is
  'Puente entre dispositivos del MISMO usuario para Recepción: el celular escanea un QR y la compu reacciona en vivo. Efímero — no es auditoría (eso vive en `eventos`).';

create index if not exists recepcion_eventos_user_created_idx
  on public.recepcion_eventos (user_id, created_at desc);

alter table public.recepcion_eventos enable row level security;

drop policy if exists recepcion_eventos_select_propio on public.recepcion_eventos;
create policy recepcion_eventos_select_propio on public.recepcion_eventos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists recepcion_eventos_insert_propio on public.recepcion_eventos;
create policy recepcion_eventos_insert_propio on public.recepcion_eventos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists recepcion_eventos_delete_propio on public.recepcion_eventos;
create policy recepcion_eventos_delete_propio on public.recepcion_eventos
  for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.recepcion_eventos;

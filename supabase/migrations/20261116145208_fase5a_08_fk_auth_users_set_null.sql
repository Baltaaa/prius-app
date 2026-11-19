-- Fase 5A: los clientes con cuenta de Google ahora generan eventos
-- (eventos.usuario = su auth.uid()). Sin ON DELETE, borrar la cuenta de un
-- cliente desde el panel de Auth fallaría. El Historial conserva
-- actor_nombre en texto, así que el evento sigue legible.
alter table public.eventos drop constraint eventos_usuario_fkey;
alter table public.eventos add constraint eventos_usuario_fkey
  foreign key (usuario) references auth.users(id) on delete set null;

alter table public.clientes_cuentas drop constraint clientes_cuentas_confirmado_por_fkey;
alter table public.clientes_cuentas add constraint clientes_cuentas_confirmado_por_fkey
  foreign key (confirmado_por) references auth.users(id) on delete set null;

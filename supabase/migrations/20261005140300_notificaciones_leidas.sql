-- Ítem 3: las notificaciones siguen siendo COMPUTADAS en el front
-- (useNotifications.js, a partir de reservas/caja — no hay un segundo
-- sistema de escritura de notificaciones). Lo único que se persiste es el
-- estado de lectura por usuario, contra el id sintético que ya arma el hook
-- (ej. "checkin-<reserva_id>", "saldo-<reserva_id>", "caja-pendiente").
create table notificaciones_leidas (
  usuario uuid not null references auth.users(id),
  notificacion_id text not null,
  leido_at timestamptz not null default now(),
  primary key (usuario, notificacion_id)
);

alter table notificaciones_leidas enable row level security;

create policy select_propias on notificaciones_leidas for select to authenticated
  using (usuario = auth.uid());
create policy insert_propias on notificaciones_leidas for insert to authenticated
  with check (usuario = auth.uid());
create policy delete_propias on notificaciones_leidas for delete to authenticated
  using (usuario = auth.uid());

-- Sin policy de UPDATE a propósito: una notificación ya leída no necesita
-- refrescar su timestamp — "marcar como leída" sobre una fila existente es
-- un no-op (insert ... on conflict do nothing desde el front).
grant select, insert, delete on notificaciones_leidas to authenticated;

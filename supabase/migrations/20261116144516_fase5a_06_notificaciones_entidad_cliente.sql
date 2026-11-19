-- Fase 5A, Tarea 6: la notificación "Cuenta web pendiente de confirmar"
-- apunta a un cliente (no a una reserva/pago/lead/unidad/caja).
alter table public.notificaciones drop constraint notificaciones_entidad_tipo_check;
alter table public.notificaciones add constraint notificaciones_entidad_tipo_check
  check (entidad_tipo = any (array['reserva','pago','lead','unidad','caja','cliente']));

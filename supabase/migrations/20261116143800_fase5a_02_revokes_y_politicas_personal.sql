-- Fase 5A, Tarea 2: grants y políticas. Un authenticated sin perfil (cliente
-- web con Google) no lee ni escribe nada del CRM.

-- 1. Funciones de mantenimiento: solo cron / triggers (definer) / service_role.
revoke execute on function public.fn_clima_diario_solicitar() from public, anon, authenticated;
revoke execute on function public.fn_clima_diario_resolver() from public, anon, authenticated;
revoke execute on function public.fn_notif_upsert_pago_sin_monto(uuid) from public, anon, authenticated;
revoke execute on function public.fn_notif_upsert_sin_precio(uuid) from public, anon, authenticated;
revoke execute on function public.fn_encolar_aviso_cierre() from public, anon, authenticated;

-- 2. Funciones del CRM que anon podía ejecutar (por grant directo o PUBLIC).
--    Quedan públicas a propósito: cotizar y disponibilidad_publica.
do $do$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('resumen_caja','editar_gasto','fn_editar_pago_completo','guardar_categoria_gasto',
                        'registrar_gasto','fn_emitir_comprobante')
  loop
    execute format('revoke execute on function %s from public, anon', r.f);
    execute format('grant execute on function %s to authenticated, service_role', r.f);
  end loop;
end
$do$;

-- 3. Tablas: anon no usa ninguna de estas (la RLS ya lo bloqueaba).
revoke all on table public.categorias_gasto, public.clima_diario, public.clima_diario_pendiente,
  public.config_notificaciones, public.config_tipo_cambio, public.notificaciones_cola,
  public.push_suscripciones, public.recepcion_eventos, public.tipos_cambio
  from anon;

-- 4. Secuencia de comprobantes emitidos: solo la usa fn_emitir_comprobante (definer).
revoke all on sequence public.comprobantes_emitidos_numero_seq from anon, authenticated;

-- 5. Políticas que no exigían perfil.
alter policy tipos_cambio_select on public.tipos_cambio using (usuario_activo());
alter policy config_tipo_cambio_select on public.config_tipo_cambio using (usuario_activo());

alter policy select_propias on public.notificaciones_leidas using (usuario = (select auth.uid()) and usuario_activo());
alter policy insert_propias on public.notificaciones_leidas with check (usuario = (select auth.uid()) and usuario_activo());
alter policy delete_propias on public.notificaciones_leidas using (usuario = (select auth.uid()) and usuario_activo());

alter policy select_propias_notif_usuario on public.notificaciones_usuario using (usuario_id = (select auth.uid()) and usuario_activo());
alter policy update_propias_notif_usuario on public.notificaciones_usuario
  using (usuario_id = (select auth.uid()) and usuario_activo())
  with check (usuario_id = (select auth.uid()) and usuario_activo());

alter policy propias on public.preferencias_usuario to authenticated
  using (usuario = (select auth.uid()) and usuario_activo())
  with check (usuario = (select auth.uid()) and usuario_activo());

alter policy push_sus_propias on public.push_suscripciones
  using (user_id = (select auth.uid()) and usuario_activo())
  with check (user_id = (select auth.uid()) and usuario_activo());

alter policy recepcion_eventos_select_propio on public.recepcion_eventos using (user_id = (select auth.uid()) and usuario_activo());
alter policy recepcion_eventos_insert_propio on public.recepcion_eventos with check (user_id = (select auth.uid()) and usuario_activo());
alter policy recepcion_eventos_delete_propio on public.recepcion_eventos using (user_id = (select auth.uid()) and usuario_activo());

alter policy select_propias on public.vistas_recientes to authenticated using (usuario = (select auth.uid()) and usuario_activo());
alter policy update_propias on public.vistas_recientes to authenticated using (usuario = (select auth.uid()) and usuario_activo());
alter policy upsert_propias on public.vistas_recientes to authenticated with check (usuario = (select auth.uid()) and usuario_activo());

-- 6. Políticas con rol `public` (incluye anon): se acotan a authenticated.
alter policy auth_select_categorias_gasto on public.categorias_gasto to authenticated;
alter policy auth_insert_clientes on public.clientes to authenticated;
alter policy auth_select_clientes on public.clientes to authenticated;
alter policy auth_update_clientes on public.clientes to authenticated;
alter policy auth_all_reserva_grupos on public.reserva_grupos to authenticated;
alter policy auth_insert_reservas on public.reservas to authenticated;
alter policy auth_select_reservas on public.reservas to authenticated;
alter policy auth_update_reservas on public.reservas to authenticated;

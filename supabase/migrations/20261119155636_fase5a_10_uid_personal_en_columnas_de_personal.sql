-- Fase 5A, fix 19/11/2026: un usuario de Google (cliente web) nunca se guarda en
-- columnas que identifican al personal (eventos.usuario, notificaciones.actor_id).
-- Origen: completar_cuenta() falló con 23503 en eventos_usuario_fkey. La FK apunta
-- a auth.users y el JWT era de un usuario ya borrado (sesión vieja del navegador:
-- el JWT sigue siendo válido hasta que vence aunque el usuario no exista).
--
-- 1) fn_uid_personal(): auth.uid() solo si tiene perfil del personal; si no, null.
-- 2) Triggers que guardaban auth.uid() y que pueden correr en un camino de cliente
--    web: fn_log_evento, fn_clientes_cuentas_evento, fn_notif_reservas,
--    fn_notif_pagos, fn_notif_caja. El nombre del actor no cambia ('Web (cliente)'
--    o 'Sistema' cuando no hay perfil); el dato del personal se conserva.
-- 3) completar_cuenta() y mi_cuenta(): si el usuario del JWT ya no existe en
--    auth.users, 'login_requerido' (motivo 'sesion_invalida') en vez de un 500.
-- Las funciones de escritura del personal (caja, pagos, gastos, comprobantes,
-- recepción, estado de pago, temporada) no cambian: exigen perfil
-- (fn_exigir_personal) o no son ejecutables por authenticated.

create or replace function public.fn_uid_personal()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id from public.perfiles p where p.user_id = auth.uid();
$$;

revoke all on function public.fn_uid_personal() from public, anon, authenticated;
grant execute on function public.fn_uid_personal() to service_role;

comment on function public.fn_uid_personal() is
  'auth.uid() solo si es del personal (tiene perfil); null para clientes web, service_role y cron. Usar en toda columna que identifique al personal.';

do $$
declare
  v_def text;
  v_new text;
  r record;
begin
  for r in
    select * from (values
      ('public.fn_log_evento()'::regprocedure,
       'auth.uid(), v_tipo, v_actor_nombre, v_cliente_id, v_cliente_nombre',
       'public.fn_uid_personal(), v_tipo, v_actor_nombre, v_cliente_id, v_cliente_nombre'),
      ('public.fn_clientes_cuentas_evento()'::regprocedure,
       'auth.uid(), v_tipo, v_actor, v_row.cliente_id, v_cliente_nombre',
       'public.fn_uid_personal(), v_tipo, v_actor, v_row.cliente_id, v_cliente_nombre'),
      ('public.fn_notif_reservas()'::regprocedure,
       'v_actor uuid := auth.uid();',
       'v_actor uuid := public.fn_uid_personal();'),
      ('public.fn_notif_pagos()'::regprocedure,
       'v_actor uuid := auth.uid();',
       'v_actor uuid := public.fn_uid_personal();'),
      ('public.fn_notif_caja()'::regprocedure,
       'v_actor uuid := auth.uid();',
       'v_actor uuid := public.fn_uid_personal();'),
      ('public.completar_cuenta(jsonb)'::regprocedure,
       E'  if v_uid is null then\n    return jsonb_build_object(''ok'', false, ''error'', ''login_requerido'');\n  end if;\n',
       E'  if v_uid is null then\n    return jsonb_build_object(''ok'', false, ''error'', ''login_requerido'');\n  end if;\n  -- Sesión de un usuario ya borrado (el JWT sigue vigente hasta que vence).\n  if not exists (select 1 from auth.users where id = v_uid) then\n    return jsonb_build_object(''ok'', false, ''error'', ''login_requerido'', ''motivo'', ''sesion_invalida'');\n  end if;\n'),
      ('public.mi_cuenta()'::regprocedure,
       E'  if v_uid is null then\n    return jsonb_build_object(''ok'', false, ''error'', ''login_requerido'');\n  end if;\n',
       E'  if v_uid is null then\n    return jsonb_build_object(''ok'', false, ''error'', ''login_requerido'');\n  end if;\n  -- Sesión de un usuario ya borrado (el JWT sigue vigente hasta que vence).\n  if not exists (select 1 from auth.users where id = v_uid) then\n    return jsonb_build_object(''ok'', false, ''error'', ''login_requerido'', ''motivo'', ''sesion_invalida'');\n  end if;\n')
    ) as t(fn, viejo, nuevo)
  loop
    v_def := pg_get_functiondef(r.fn);
    if position(r.viejo in v_def) = 0 then
      raise exception 'fase5a_10: no encontré el texto a reemplazar en %', r.fn;
    end if;
    v_new := replace(v_def, r.viejo, r.nuevo);
    execute v_new;
  end loop;
end $$;

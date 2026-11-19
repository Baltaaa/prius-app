-- Fase 5A, Tarea 2 (16/11/2026): authenticated deja de ser sinónimo de
-- "personal del CRM" (llegan las cuentas de clientes con Google). Toda
-- función SECURITY DEFINER que usa el CRM exige un perfil activo.
--
-- fn_exigir_personal(): deja pasar
--   * service_role (Edge Functions con la service key),
--   * conexiones directas sin JWT (pg_cron, migraciones, SQL del panel),
-- y a todo lo que llega por la API con rol anon/authenticated le exige
-- usuario_activo(). Un `if not usuario_activo()` pelado rompería el cron
-- de cierre automático y a crear_reserva_publica (service_role), que pasan
-- por estas funciones sin perfil.
create or replace function public.fn_exigir_personal()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(current_setting('request.jwt.claims', true), '') is null
     and nullif(current_setting('request.jwt.claim.role', true), '') is null then
    return; -- conexión directa (cron / migración): no hay request de la API
  end if;
  if auth.role() = 'service_role' then
    return;
  end if;
  if not public.usuario_activo() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.fn_exigir_personal() from public, anon;
grant execute on function public.fn_exigir_personal() to authenticated, service_role;

-- Funciones plpgsql: se inserta `perform public.fn_exigir_personal();` como
-- primera sentencia del bloque principal (después del primer `begin`), sin
-- tocar el resto del cuerpo. Idempotente.
do $do$
declare
  r record;
  d text;
  n int := 0;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname = any (array[
        'registrar_pago','crear_reserva','fn_crear_reserva_con_pago','completar_comprobante',
        'fn_emitir_comprobante','registrar_gasto','anular_gasto','abrir_caja','cerrar_caja',
        'fn_cierre_automatico_caja','resumen_caja','fn_resumen_caja_base','marcar_password_cambiada'])
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
  loop
    d := pg_get_functiondef(r.oid);
    continue when position('fn_exigir_personal' in d) > 0;
    d := regexp_replace(d, '^begin[ \t]*$', E'begin\n  perform public.fn_exigir_personal();', 'ni');
    if position('fn_exigir_personal' in d) = 0 then
      raise exception 'No encontré el begin principal de %', r.sig;
    end if;
    execute d;
    n := n + 1;
  end loop;
  if n <> 14 then
    raise exception 'Esperaba parchear 14 funciones y parché %', n;
  end if;
end
$do$;

-- fn_registrar_evento_auth: un cliente web no ensucia el Historial.
CREATE OR REPLACE FUNCTION public.fn_registrar_evento_auth(p_tipo_evento text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor_nombre text;
  v_desc text;
begin
  if auth.uid() is null or not public.usuario_activo() then
    return; -- sin sesión de personal (o cliente web) no se loguea nada; no-op
  end if;

  if p_tipo_evento not in ('login', 'logout', 'logout_inactividad') then
    raise exception 'tipo_evento inválido para fn_registrar_evento_auth: %', p_tipo_evento;
  end if;

  select nombre into v_actor_nombre from perfiles where user_id = auth.uid();
  if v_actor_nombre is null then
    v_actor_nombre := 'Sistema';
  end if;

  v_desc := case p_tipo_evento
    when 'login' then 'Inicio de sesión'
    when 'logout' then 'Cierre de sesión'
    when 'logout_inactividad' then 'Cierre de sesión por inactividad'
  end;

  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento, actor_nombre, cliente_id, cliente_nombre)
  values ('auth', 'INSERT', null, v_desc, public.fn_hoy_ar(), null, auth.uid(), p_tipo_evento, v_actor_nombre, null, null);
end;
$function$;

-- historial_entidad: de SQL a plpgsql para poder cortar antes de leer.
CREATE OR REPLACE FUNCTION public.historial_entidad(p_tipo text, p_id uuid DEFAULT NULL::uuid, p_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_tipos_evento text[] DEFAULT NULL::text[])
 RETURNS SETOF eventos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform public.fn_exigir_personal();
  return query
  select e.*
  from eventos e
  where
    (p_tipos_evento is null or e.tipo_evento = any(p_tipos_evento))
    and (p_cursor is null or e.ts < p_cursor)
    and (
      p_tipo = 'global'
      or (p_tipo = 'cliente' and (
        (e.tabla = 'clientes' and e.registro_id = p_id)
        or (e.tabla in ('reservas', 'pagos', 'comprobantes') and (
          (e.datos->'after'->>'cliente_id')::uuid = p_id
          or (e.datos->'before'->>'cliente_id')::uuid = p_id
        ))
      ))
      or (p_tipo = 'reserva' and (
        (e.tabla = 'reservas' and e.registro_id = p_id)
        or (e.tabla = 'pagos' and (
          (e.datos->'after'->>'reserva_id')::uuid = p_id
          or (e.datos->'before'->>'reserva_id')::uuid = p_id
        ))
        or (e.tabla = 'comprobantes' and exists (
          select 1 from pagos pg
          where pg.id = coalesce((e.datos->'after'->>'pago_id')::uuid, (e.datos->'before'->>'pago_id')::uuid)
          and pg.reserva_id = p_id
        ))
      ))
      or (p_tipo = 'unidad' and (
        (e.tabla = 'unidades' and e.registro_id = p_id)
        or (e.tabla = 'reservas' and (
          (e.datos->'after'->>'unidad_id')::uuid = p_id
          or (e.datos->'before'->>'unidad_id')::uuid = p_id
        ))
        or (e.tabla = 'pagos' and exists (
          select 1 from reservas r
          where r.unidad_id = p_id
          and r.id = coalesce((e.datos->'after'->>'reserva_id')::uuid, (e.datos->'before'->>'reserva_id')::uuid)
        ))
        or (e.tabla = 'comprobantes' and exists (
          select 1 from pagos pg join reservas r on r.id = pg.reserva_id
          where pg.id = coalesce((e.datos->'after'->>'pago_id')::uuid, (e.datos->'before'->>'pago_id')::uuid)
          and r.unidad_id = p_id
        ))
      ))
    )
  order by e.fecha_ref desc, e.ts desc
  limit coalesce(p_limit, 20);
end;
$function$;

-- buscar_unidad_vecina: de SQL a plpgsql (crear_reserva_publica la llama
-- con service_role, que fn_exigir_personal deja pasar).
CREATE OR REPLACE FUNCTION public.buscar_unidad_vecina(p_unidad uuid, p_desde date, p_hasta date)
 RETURNS TABLE(unidad_id uuid, contigua boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  perform public.fn_exigir_personal();
  return query
  with base as (
    select fila, orden, tipo from unidades where id = p_unidad
  ),
  libres as (
    select d.unidad_id, d.fila, d.orden
    from disponibilidad_publica(p_desde, p_hasta) d, base b
    where not d.bloqueada and d.tipo = b.tipo and d.unidad_id <> p_unidad
  )
  select l.unidad_id, (l.fila = b.fila and abs(l.orden - b.orden) = 1)
  from libres l, base b
  order by (l.fila is distinct from b.fila), abs(coalesce(l.orden,0) - coalesce(b.orden,0)), l.fila, l.orden
  limit 1;
end;
$function$;

-- fn_cotizacion_vigente: de SQL a plpgsql.
CREATE OR REPLACE FUNCTION public.fn_cotizacion_vigente()
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.fn_exigir_personal();
  return (
    select case c.lado when 'compra' then tc.compra else tc.venta end
    from public.config_tipo_cambio c
    join public.tipos_cambio tc on tc.tipo = c.tipo
    order by tc.fecha desc limit 1
  );
end;
$function$;

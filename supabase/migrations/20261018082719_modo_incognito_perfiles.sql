-- B5 (oct 2026): modo incógnito — con el modo activo, la cuenta dueña no
-- registra SUS PROPIOS eventos de sesión (login/logout/logout_inactividad)
-- en `eventos`. Eventos operativos/financieros (pagos, reservas, caja) NO
-- se tocan: viven en un camino completamente distinto (triggers
-- trg_zzz_log_evento sobre esas tablas), nunca pasan por
-- fn_registrar_evento_auth.
--
-- Habilitación restringida del lado del servidor (no solo ocultando el
-- botón en el front): fn_toggle_modo_incognito() verifica auth.uid() contra
-- un user_id hardcodeado acá mismo — cualquier otro usuario que la llame
-- recibe una excepción. Hay más de un superadmin (Chelo, Marcelo Madotta,
-- Balta), así que una policy genérica "cualquier superadmin puede
-- actualizar su propio perfil" no alcanzaría para cumplir "que otro usuario
-- no pueda activarlo".

alter table perfiles
  add column modo_incognito boolean not null default false;

comment on column perfiles.modo_incognito is
  'B5 oct 2026: con esto en true, fn_registrar_evento_auth no inserta los eventos de sesión de ESTE usuario (login/logout/logout_inactividad). Solo se puede activar via fn_toggle_modo_incognito(), restringida a un user_id puntual.';

create or replace function fn_toggle_modo_incognito()
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_allowed_user_id uuid := 'ccae0faf-3b4c-402b-902e-b0cd3c5dc1e8'; -- Baltasar Bruschetti
  v_nuevo_valor boolean;
begin
  if auth.uid() is null or auth.uid() != v_allowed_user_id then
    raise exception 'No tenés permiso para activar el modo incógnito.';
  end if;

  update perfiles
  set modo_incognito = not modo_incognito
  where user_id = v_allowed_user_id
  returning modo_incognito into v_nuevo_valor;

  return v_nuevo_valor;
end;
$function$;

revoke all on function fn_toggle_modo_incognito() from public;
grant execute on function fn_toggle_modo_incognito() to authenticated;

-- fn_registrar_evento_auth: mismo cuerpo de siempre, con el chequeo de
-- modo_incognito agregado al principio (filtro del lado del servidor, no
-- solo en el front) — el resto de la función queda idéntico.
create or replace function public.fn_registrar_evento_auth(p_tipo_evento text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor_nombre text;
  v_desc text;
  v_modo_incognito boolean;
begin
  if auth.uid() is null then
    return; -- sin sesión no hay quién loguear; no es un error, simplemente no-op
  end if;

  if p_tipo_evento not in ('login', 'logout', 'logout_inactividad') then
    raise exception 'tipo_evento inválido para fn_registrar_evento_auth: %', p_tipo_evento;
  end if;

  select nombre, modo_incognito into v_actor_nombre, v_modo_incognito from perfiles where user_id = auth.uid();

  -- B5: con modo incógnito activo, no se registra el evento de sesión de
  -- este usuario — eventos operativos/financieros no pasan por acá, siguen
  -- registrándose siempre vía sus propios triggers.
  if v_modo_incognito is true then
    return;
  end if;

  if v_actor_nombre is null then
    v_actor_nombre := 'Sistema';
  end if;

  v_desc := case p_tipo_evento
    when 'login' then 'Inicio de sesión'
    when 'logout' then 'Cierre de sesión'
    when 'logout_inactividad' then 'Cierre de sesión por inactividad'
  end;

  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento, actor_nombre, cliente_id, cliente_nombre)
  values ('auth', 'INSERT', null, v_desc, current_date, null, auth.uid(), p_tipo_evento, v_actor_nombre, null, null);
end;
$function$;

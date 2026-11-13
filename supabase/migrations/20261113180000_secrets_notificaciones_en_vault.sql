-- Secrets de notificaciones en el vault (nov 2026, fase 1).
--
-- Antes la idea era cargarlos como secrets de Edge Function. Se cambió: el
-- cron ya lee el secret interno del vault (fn_disparar_notificaciones), así
-- que tener la mitad de los valores ahí y la otra mitad en los secrets de la
-- función era la forma más segura de que se desincronizaran, y rotar
-- obligaría a tocar dos lados. Con todo en el vault hay UN solo lugar.
--
-- El par VAPID se generó DENTRO de Supabase (Edge Function temporal
-- `bootstrap-vapid`, ya retirada): la privada nunca existió en un archivo
-- local ni pasó por una terminal. La pública, que no es secreta, está
-- commiteada en src/config/push.ts.

-- El subject no es secreto (VAPID lo manda en claro en cada push), pero vive
-- al lado de los otros para que la RPC devuelva el juego completo.
select vault.create_secret(
  'mailto:bruschettibalta@gmail.com',
  'prius_vapid_subject',
  'VAPID subject (mailto de contacto). Lo exige el estándar y viaja en claro: no es secreto, está acá para que fn_secrets_notificaciones devuelva el juego completo.'
) where not exists (select 1 from vault.secrets where name = 'prius_vapid_subject');

-- prius_vapid_public_key y prius_vapid_private_key los crea el bootstrap, no
-- esta migración: el valor nunca se escribe en un archivo del repo.

-- Juego completo de secrets para las Edge Functions de notificaciones.
-- SECURITY DEFINER + grant SOLO a service_role: ni anon ni authenticated
-- pueden ejecutarla, así que no hay forma de pedirla desde el navegador.
create or replace function public.fn_secrets_notificaciones()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'vault', 'pg_temp'
as $fn$
  select jsonb_object_agg(
    case name
      when 'prius_vapid_public_key'  then 'VAPID_PUBLIC_KEY'
      when 'prius_vapid_private_key' then 'VAPID_PRIVATE_KEY'
      when 'prius_vapid_subject'     then 'VAPID_SUBJECT'
      when 'prius_internal_secret'   then 'INTERNAL_SECRET'
    end,
    decrypted_secret
  )
  from vault.decrypted_secrets
  where name in (
    'prius_vapid_public_key', 'prius_vapid_private_key',
    'prius_vapid_subject', 'prius_internal_secret'
  );
$fn$;

comment on function public.fn_secrets_notificaciones() is
  'Devuelve VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT e INTERNAL_SECRET desde el vault. Solo service_role (las Edge Functions); nunca invocable desde el cliente.';

revoke all on function public.fn_secrets_notificaciones() from public, anon, authenticated;
grant execute on function public.fn_secrets_notificaciones() to service_role;

-- Las temporales del bootstrap no quedan vivas: exponían o escribían el
-- vault y ya cumplieron.
drop function if exists public.fn_tmp_leer_internal_secret();
drop function if exists public.fn_bootstrap_vapid(boolean);
drop function if exists public.fn_vault_existe(text);
drop function if exists public.fn_vault_crear(text, text, text);
drop function if exists public.fn_vault_actualizar(text, text);

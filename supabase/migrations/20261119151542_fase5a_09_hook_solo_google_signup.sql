-- Auth Hook "Before User Created" (Fase 5A): el signup general queda prendido
-- para que entren clientes nuevos con Google, pero cualquier alta que no venga
-- de Google (email/contraseña, teléfono, anónimo, invitación) se rechaza.
--
-- Qué vías disparan el hook (verificado en el código de supabase/auth,
-- internal/api): signup público, OAuth/OIDC, SAML, anónimo, web3, invitación
-- (/invite, "Invite user" del dashboard) y generate_link de tipo signup/invite.
-- NO lo dispara adminUserCreate (POST /admin/users): "Create new user" del
-- dashboard y auth.admin.createUser() con service role. Esa es la vía para el
-- personal del CRM. Una invitación llega al hook igual que un signup público
-- (provider 'email', sin marca de invitación), así que también se rechaza.
create or replace function public.hook_solo_google_signup(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if v_provider = 'google' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'El registro solo está habilitado con Google.'
    )
  );
end;
$$;

revoke all on function public.hook_solo_google_signup(jsonb) from public, anon, authenticated;
grant execute on function public.hook_solo_google_signup(jsonb) to supabase_auth_admin;

comment on function public.hook_solo_google_signup(jsonb) is
  'Auth Hook Before User Created: solo permite altas con provider google. El personal se crea con Create new user / admin.createUser (no pasa por el hook).';

-- Aviso automático al cerrar la caja (nov 2026, Tarea 5).
--
-- Tres piezas en la base: la configuración (a quién y por dónde), la cola
-- (qué queda por mandar) y las suscripciones de push. El envío lo hace la
-- Edge Function `notificar-cierre-caja`, que pg_cron despierta cada 5 min.

-- ------------------------------------------------------ configuración
create table if not exists public.config_notificaciones (
  id              boolean primary key default true check (id),
  -- [{nombre, telefono_e164, activo, callmebot_apikey}] — vacío al inicio.
  destinatarios   jsonb not null default '[]'::jsonb,
  canal_whatsapp  text not null default 'cloud_api'
                  check (canal_whatsapp in ('cloud_api', 'callmebot', 'off')),
  -- Horario de silencio: un cierre que cae adentro se manda al terminar.
  silencio_desde  time not null default '00:00',
  silencio_hasta  time not null default '08:00',
  mostrar_montos_en_push boolean not null default true,
  updated_at      timestamptz not null default now()
);

insert into public.config_notificaciones (id) values (true) on conflict (id) do nothing;

alter table public.config_notificaciones enable row level security;

drop policy if exists config_notif_select on public.config_notificaciones;
create policy config_notif_select on public.config_notificaciones
  for select to authenticated using (public.es_superadmin());

drop policy if exists config_notif_update on public.config_notificaciones;
create policy config_notif_update on public.config_notificaciones
  for update to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

comment on table public.config_notificaciones is
  'Fila única con los destinatarios y el canal de los avisos de cierre de caja. Trae teléfonos: solo superadmin.';

-- -------------------------------------------------------------- la cola
create table if not exists public.notificaciones_cola (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null default 'cierre_caja',
  caja_id            uuid references public.caja_diaria(id) on delete cascade,
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente', 'enviado', 'error')),
  intentos           integer not null default 0,
  enviar_despues_de  timestamptz not null default now(),
  -- Resultado por canal: {whatsapp: {...}, push: {...}} — ningún canal
  -- voltea el proceso, se registra qué pasó con cada uno.
  resultado          jsonb,
  ultimo_error       text,
  es_prueba          boolean not null default false,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz
);

-- Idempotencia: una caja no se encola dos veces para el mismo aviso. Las
-- pruebas y los reenvíos manuales quedan fuera del índice.
create unique index if not exists uq_notif_cola_tipo_caja
  on public.notificaciones_cola (tipo, caja_id) where not es_prueba;

create index if not exists idx_notif_cola_pendientes
  on public.notificaciones_cola (estado, enviar_despues_de) where estado = 'pendiente';

alter table public.notificaciones_cola enable row level security;
-- Sin policies: solo service role (la Edge Function y el cron).

-- ----------------------------------------------- suscripciones de push
create table if not exists public.push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_suscripciones_user on public.push_suscripciones (user_id);

alter table public.push_suscripciones enable row level security;

drop policy if exists push_sus_propias on public.push_suscripciones;
create policy push_sus_propias on public.push_suscripciones
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------- trigger de la cola
-- Al pasar a cerrada (manual o automática), la caja se encola. Reabrir y
-- volver a cerrar no duplica el aviso (índice único).
create or replace function public.fn_encolar_aviso_cierre()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cfg      config_notificaciones;
  v_ahora_ar timestamp;
  v_hora     time;
  v_cuando   timestamptz := now();
  v_en_silencio boolean;
begin
  if new.estado <> 'cerrada' or coalesce(old.estado, '') = 'cerrada' then
    return new;
  end if;

  select * into v_cfg from config_notificaciones where id;

  if found then
    v_ahora_ar := (now() at time zone 'America/Argentina/Buenos_Aires');
    v_hora := v_ahora_ar::time;
    -- El silencio puede cruzar la medianoche (22:00-08:00).
    v_en_silencio := case
      when v_cfg.silencio_desde = v_cfg.silencio_hasta then false
      when v_cfg.silencio_desde < v_cfg.silencio_hasta
        then v_hora >= v_cfg.silencio_desde and v_hora < v_cfg.silencio_hasta
      else v_hora >= v_cfg.silencio_desde or v_hora < v_cfg.silencio_hasta
    end;

    if v_en_silencio then
      v_cuando := ((
        case when v_hora < v_cfg.silencio_hasta then v_ahora_ar::date
             else v_ahora_ar::date + 1 end
      ) + v_cfg.silencio_hasta) at time zone 'America/Argentina/Buenos_Aires';
    end if;
  end if;

  insert into notificaciones_cola (tipo, caja_id, enviar_despues_de)
  values ('cierre_caja', new.id, v_cuando)
  on conflict (tipo, caja_id) where not es_prueba do nothing;

  return new;
end;
$fn$;

drop trigger if exists trg_encolar_aviso_cierre on public.caja_diaria;
drop trigger if exists trg_a_encolar_aviso_cierre on public.caja_diaria;
-- `trg_a_` para que corra antes que el logger (`trg_zzz_log_evento`).
create trigger trg_a_encolar_aviso_cierre
  after update of estado on public.caja_diaria
  for each row execute function public.fn_encolar_aviso_cierre();

-- -------------------------------------------------------- cron + pg_net
-- Despierta a la Edge Function que procesa la cola. No manda datos: la
-- función lee la cola ella misma y decide qué enviar. Los secrets salen de
-- vault, no del comando del cron.
create or replace function public.fn_disparar_notificaciones()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_secret text;
  v_anon   text;
  v_id     bigint;
begin
  -- Si no hay nada pendiente y vencido, no se gasta una llamada.
  if not exists (
    select 1 from notificaciones_cola
    where estado = 'pendiente' and enviar_despues_de <= now() and intentos < 3
  ) then
    return null;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'prius_internal_secret';
  select decrypted_secret into v_anon   from vault.decrypted_secrets where name = 'prius_anon_key';
  if v_secret is null or v_anon is null then
    raise warning '[notificaciones] faltan los secrets en vault, no se dispara el envío';
    return null;
  end if;

  select net.http_post(
    url := 'https://oslbsnwccchdxmbjhhcg.supabase.co/functions/v1/notificar-cierre-caja',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-prius-secret', v_secret
    ),
    body := jsonb_build_object('origen', 'cron'),
    timeout_milliseconds := 25000
  ) into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.fn_disparar_notificaciones() from public, anon, authenticated;

-- select cron.schedule('notificar-cierre-caja', '*/5 * * * *',
--   $$select public.fn_disparar_notificaciones()$$);
-- (aplicado en producción el 13/11/2026; el jobid quedó en 9)

-- -------------------------------------------------- bucket de los PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reportes', 'reportes', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists reportes_select_usuarios on storage.objects;
create policy reportes_select_usuarios on storage.objects
  for select to authenticated
  using (bucket_id = 'reportes' and public.usuario_activo());

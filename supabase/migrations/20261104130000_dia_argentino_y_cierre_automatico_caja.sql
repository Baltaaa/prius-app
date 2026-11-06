-- El día de negocio es el día argentino (America/Argentina/Buenos_Aires), no el UTC de la base.
-- `current_date` / `now()::date` devuelven el día UTC: pasadas las 21:00 ART ya es "mañana", y eso
-- movía pagos, cajas y eventos al día siguiente. Sin cambiar la zona horaria global de la base.
--
-- 1) fn_hoy_ar(): única definición de "hoy" en la base.
-- 2) Toda función/trigger que calculaba el día con current_date pasa a fn_hoy_ar() (se reescribe la
--    definición vigente con pg_get_functiondef, así no se pierde ninguna otra lógica).
-- 3) Cierre automático de caja: fn_cierre_automatico_caja() + pg_cron a las 00:00 ART (03:00 UTC).
--    El cierre manual (cerrar_caja) sigue igual y anula el automático.

create or replace function public.fn_hoy_ar(p_ahora timestamptz default now())
returns date language sql stable
as $$ select (p_ahora at time zone 'America/Argentina/Buenos_Aires')::date $$;

revoke all on function public.fn_hoy_ar(timestamptz) from public, anon;
grant execute on function public.fn_hoy_ar(timestamptz) to authenticated, service_role;

-- Estado del cierre automático (el estado sigue siendo 'cerrada': todo el front y los reportes lo respetan).
alter table public.caja_diaria
  add column if not exists cierre_automatico boolean not null default false,
  add column if not exists arqueo_pendiente boolean not null default false;
comment on column public.caja_diaria.cierre_automatico is 'La caja la cerró el sistema a las 00:00 ART (cerrada_por = null).';
comment on column public.caja_diaria.arqueo_pendiente is 'Cierre automático sin arqueo ni Z todavía; el cierre manual lo resuelve.';

alter table public.caja_diaria alter column fecha set default public.fn_hoy_ar();

alter table public.caja_eventos drop constraint if exists caja_eventos_tipo_check;
alter table public.caja_eventos add constraint caja_eventos_tipo_check
  check (tipo = any (array['apertura','cierre','reapertura','anulacion_pago','anulacion_gasto','cierre_automatico']));

-- Reescritura de funciones: current_date -> fn_hoy_ar(), ::date de un timestamptz -> día ART.
do $$
declare
  f record;
  v_def text;
  v_art text := 'America/Argentina/Buenos_Aires';
begin
  for f in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname in ('fn_registrar_pago_interno','fn_pago_crea_ingreso_caja','completar_comprobante',
                        'fn_crear_reserva_con_pago','fn_log_evento','fn_registrar_evento_auth',
                        'fn_registrar_evento_superadmin','fn_reserva_vigente')
  loop
    v_def := pg_get_functiondef(f.oid);
    v_def := replace(v_def, '((v_new->>''created_at'')::timestamptz)::date', '(((v_new->>''created_at'')::timestamptz) at time zone ''' || v_art || ''')::date');
    v_def := replace(v_def, '((v_old->>''created_at'')::timestamptz)::date', '(((v_old->>''created_at'')::timestamptz) at time zone ''' || v_art || ''')::date');
    v_def := regexp_replace(v_def, '\mcurrent_date\M', 'public.fn_hoy_ar()', 'gi');
    execute v_def;
  end loop;
end $$;

-- cerrar_caja (las dos versiones): permite cerrar a mano una caja cerrada automáticamente con arqueo
-- pendiente (anula el cierre automático) y limpia sus marcas.
do $$
declare
  f record;
  v_def text;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'cerrar_caja'
  loop
    v_def := pg_get_functiondef(f.oid);
    v_def := replace(v_def,
      'if v_caja.estado <> ''abierta'' then raise exception ''La caja ya está cerrada.''; end if;',
      'if v_caja.estado <> ''abierta'' and not (v_caja.cierre_automatico and v_caja.arqueo_pendiente) then raise exception ''La caja ya está cerrada.''; end if;');
    v_def := replace(v_def, E'    estado = ''cerrada'',\n', E'    estado = ''cerrada'',\n    cierre_automatico = false,\n    arqueo_pendiente = false,\n');
    execute v_def;
  end loop;
end $$;

-- reabrir_caja: limpia las marcas del cierre automático.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.reabrir_caja(uuid,text)'::regprocedure);
  v_def := replace(v_def, 'update caja_diaria set estado = ''abierta'', cerrada_at = null',
                          'update caja_diaria set estado = ''abierta'', cerrada_at = null, cierre_automatico = false, arqueo_pendiente = false');
  execute v_def;
end $$;

-- Cierre automático: toda caja abierta con fecha anterior a hoy (ART) se cierra con los totales del
-- sistema, sin arqueo (efectivo contado y diferencia quedan en null), a las 23:59:59 de su día.
-- `p_ahora` permite simular la hora en las pruebas; en producción siempre es now().
create or replace function public.fn_cierre_automatico_caja(p_ahora timestamptz default now())
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  v_n integer := 0;
  v_esperado numeric;
  v_hoy date := public.fn_hoy_ar(p_ahora);
begin
  for r in
    select id, fecha from caja_diaria
    where estado = 'abierta' and fecha < v_hoy and fecha >= public.fn_caja_inicio()
    order by fecha
    for update skip locked
  loop
    perform public.fn_recalcula_totales_caja(r.id);

    select coalesce(sum(monto), 0) into v_esperado
    from pagos where caja_id = r.id and estado = 'vigente' and medio = 'efectivo';
    v_esperado := v_esperado - coalesce((
      select sum(monto) from gastos_caja
      where caja_id = r.id and estado = 'vigente' and medio_pago = 'efectivo'), 0);

    update caja_diaria set
      estado = 'cerrada',
      cerrada_por = null,
      cerrada_at = ((r.fecha + time '23:59:59') at time zone 'America/Argentina/Buenos_Aires'),
      cierre_automatico = true,
      arqueo_pendiente = true,
      efectivo_esperado = v_esperado,
      efectivo_contado = null,
      diferencia = null,
      observaciones_cierre = 'Cierre automático del sistema: falta el arqueo y la Z.'
    where id = r.id;

    update caja_diaria set resumen_snapshot = resumen_caja(r.id) where id = r.id;

    insert into caja_eventos (caja_id, tipo, detalle, usuario)
    values (r.id, 'cierre_automatico',
            jsonb_build_object('fecha', r.fecha, 'efectivo_esperado', v_esperado, 'arqueo_pendiente', true), null);
    -- El trigger de eventos (fn_log_evento) deja además "Caja cerrada" en el Historial.

    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.fn_cierre_automatico_caja(timestamptz) from public, anon;
grant execute on function public.fn_cierre_automatico_caja(timestamptz) to authenticated, service_role;

-- Respaldo: también se ejecuta al abrir la caja y al registrar un pago.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.abrir_caja(numeric)'::regprocedure);
  v_def := replace(v_def, E'\nbegin\n', E'\nbegin\n  perform public.fn_cierre_automatico_caja();\n');
  execute v_def;
end $$;

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.fn_registrar_pago_interno(uuid,uuid,numeric,text,text,text,text,jsonb,boolean,date,text,numeric,numeric)'::regprocedure);
  v_def := replace(v_def, E'\nbegin\n', E'\nbegin\n  perform public.fn_cierre_automatico_caja();\n');
  execute v_def;
end $$;

-- Programación: 03:00 UTC = 00:00 ART (Argentina no usa horario de verano).
select cron.unschedule(jobid) from cron.job where jobname = 'cierre-automatico-caja';
select cron.schedule('cierre-automatico-caja', '0 3 * * *', $cron$select public.fn_cierre_automatico_caja()$cron$);

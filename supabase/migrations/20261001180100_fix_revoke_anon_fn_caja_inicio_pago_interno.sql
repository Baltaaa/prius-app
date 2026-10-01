-- Igual que otras veces en esta sesión: ALTER DEFAULT PRIVILEGES de este
-- proyecto le otorga EXECUTE directo a anon/authenticated en toda función
-- nueva del esquema public (no es un grant vía PUBLIC, por eso "revoke ...
-- from public" no alcanza). Hay que revocar explícitamente de cada rol.
-- Se detectó con el advisor de seguridad justo después de aplicar
-- 20261001180000_pagos_historicos_fecha_y_caja.sql.
-- De paso, fn_caja_inicio() queda con search_path fijo (igual que el resto
-- de las funciones de dinero) — es SQL inmutable sin riesgo real, pero
-- consistente con el patrón de seguridad del resto de la base.
create or replace function public.fn_caja_inicio()
returns date
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select date '2026-10-01';
$function$;

revoke execute on function public.fn_caja_inicio() from anon;
revoke execute on function public.fn_caja_inicio() from authenticated;
grant execute on function public.fn_caja_inicio() to authenticated;

revoke execute on function public.fn_registrar_pago_interno(uuid, uuid, numeric, text, text, text, text, jsonb, boolean, date) from anon;
revoke execute on function public.fn_registrar_pago_interno(uuid, uuid, numeric, text, text, text, text, jsonb, boolean, date) from authenticated;

-- SEGURIDAD URGENTE (31/10/2026) — regresión introducida en la migración
-- 20261031080000. Aplicada en producción vía MCP.
--
-- Al migrar registrar_pago a multi-moneda se hizo `drop function` +
-- `create function` sobre fn_registrar_pago_interno. El DROP se llevó los
-- grants originales y el CREATE tomó el default de Postgres: EXECUTE para
-- PUBLIC. Resultado: `anon` podía invocar
-- /rest/v1/rpc/fn_registrar_pago_interno, que es la que INSERTA el pago y
-- que NO tiene el chequeo de auth.uid() — ese guard vive solo en el wrapper
-- público registrar_pago.
--
-- Verificado explotable antes del fix: con la anon key la llamada llegó al
-- INSERT y solo falló por la foreign key del cliente inexistente, no por
-- permisos. Verificado cerrado después: 42501 permission denied.
revoke execute on function public.fn_registrar_pago_interno(
  uuid, uuid, numeric, text, text, text, text, jsonb, boolean, date, text, numeric, numeric
) from public, anon, authenticated;

revoke execute on function public.fn_cotizacion_vigente() from public, anon;

-- search_path fijo en las 3 funciones nuevas (search_path injection).
alter function public.fn_normalizar_telefono_ar(text) set search_path = public;
alter function public.fn_leads_set_telefono_normalizado() set search_path = public;
alter function public.fn_perfiles_normalizar_telefono() set search_path = public;

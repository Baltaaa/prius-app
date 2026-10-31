-- SEGURIDAD (31/10/2026). Aplicada en producción vía MCP.
-- Cierre de funciones SECURITY DEFINER ejecutables con la anon key (pública,
-- viaja en el bundle del frontend).
--
-- OJO: varias estaban concedidas a PUBLIC (el `=X/postgres` del proacl), no
-- solo a `anon` — revocar únicamente a `anon` NO habría alcanzado.

-- 1) CRÍTICO — cerrar_caja no tenía NINGÚN chequeo de autenticación: buscaba
-- la caja, validaba que estuviera abierta y hacía UPDATE a 'cerrada'. Los
-- auth.uid() que usa son solo para registrar quién cerró, no para autorizar.
-- Con la anon key y un caja_id cualquiera podía cerrar la caja del día.
revoke execute on function public.cerrar_caja(uuid, numeric, jsonb, text, jsonb) from public, anon;
revoke execute on function public.cerrar_caja(uuid, numeric, jsonb, text) from public, anon;

-- 2) Notificaciones: anon podía generarlas (spam).
revoke execute on function public.fn_notif_upsert_sin_precio(uuid) from public, anon;
revoke execute on function public.fn_notif_upsert_pago_sin_monto(uuid) from public, anon;

-- 3) Funciones de TRIGGER expuestas como RPC. No las llama nadie. Un trigger
-- corre en el contexto del dueño de la tabla y no necesita EXECUTE del rol
-- que hace el DML — verificado con un INSERT real dentro de una transacción
-- revertida: el saldo se recalculó igual (3.000.000 -> 2.999.999).
revoke execute on function public.fn_pago_actualiza_saldo() from public, anon, authenticated;
revoke execute on function public.fn_cliente_libera_unidad_al_borrar() from public, anon, authenticated;

-- 4) buscar_unidad_vecina filtraba ocupación a cualquiera con la anon key.
-- Hoy solo la usa /app/dev/plano-publico (superadmin autenticado). Si el
-- sitio público algún día la necesita directo, se concede a propósito:
--   grant execute on function public.buscar_unidad_vecina(uuid, date, date) to anon;
revoke execute on function public.buscar_unidad_vecina(uuid, date, date) from public, anon;

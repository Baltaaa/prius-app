-- SEGURIDAD (31/10/2026). Aplicada en producción vía MCP.
--
-- Estas tres tablas de backup del 16/10/2026 tenían RLS DESACTIVADO, así que
-- quedaban legibles con la anon key — que viaja pública en el bundle del
-- frontend. Verificado explotable antes de borrarlas: se leyeron las 153
-- filas (127 pagos con montos, medios y clientes) con un GET al endpoint
-- REST usando solo esa clave.
--
-- Se exportaron a CSV fuera del repo antes del DROP (el repo es público):
--   ~/Desktop/Laburo/PROJECTS/PRIUS/backups-supabase-20261031/
--
-- Sin vistas dependientes, foreign keys entrantes ni funciones que las
-- mencionaran — verificado contra pg_depend, pg_constraint y pg_proc.
drop table if exists public.pagos_backup_20261016;
drop table if exists public.caja_diaria_backup_20261016;
drop table if exists public.gastos_caja_backup_20261016;

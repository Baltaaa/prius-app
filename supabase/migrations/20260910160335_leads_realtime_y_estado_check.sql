-- Módulo Leads: habilitar Realtime sobre la tabla `leads` para la bandeja del CRM
-- y acotar los estados válidos del lead.
--
-- APLICADA vía MCP el 2026-09-10.

alter publication supabase_realtime add table public.leads;

alter table public.leads
  add constraint leads_estado_check
  check (estado in ('nuevo', 'contactado', 'descartado'));

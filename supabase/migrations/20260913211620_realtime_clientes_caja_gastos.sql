-- El canal `crm-realtime` del front (DataProvider) se suscribe con
-- postgres_changes a clientes / caja_diaria / gastos_caja, pero estas tablas
-- nunca se agregaron a la publication `supabase_realtime`. Un binding sobre una
-- tabla ausente de la publication anula TODOS los eventos del canal que lo
-- contiene: por eso ni Clientes ni Caja se refrescan en vivo hoy.
--
-- (El módulo Leads ya quedó blindado moviéndose a su propio canal
-- `crm-leads-realtime` en DataProvider.jsx, pero lo correcto es arreglar el
-- canal principal.)
--
-- PENDIENTE de aplicar (el classifier de Claude Code bloqueó el apply por MCP).
-- Aplicar con `supabase db push` o a mano en el editor SQL de Supabase.
--
-- Las tres tablas tienen policy `ALL TO authenticated USING (true)`, así que
-- Realtime entrega todas sus filas al rol autenticado del CRM.

alter publication supabase_realtime add table public.clientes;
alter publication supabase_realtime add table public.caja_diaria;
alter publication supabase_realtime add table public.gastos_caja;

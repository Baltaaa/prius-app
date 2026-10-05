-- Unifica el formato de etiqueta de comprobante en toda la app: "RB-3663" /
-- "FB-727", sin punto de venta y sin ceros a la izquierda. Antes:
-- "RB 0011-00003663". Espejo de formatComprobante() en src/lib/format.ts.
-- CREATE OR REPLACE conserva los grants existentes (PUBLIC/anon/authenticated).
create or replace function public.fn_comprobante_etiqueta(c comprobantes)
 returns text
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select (
    case c.tipo
      when 'factura_a' then 'FA' when 'factura_b' then 'FB' when 'factura_c' then 'FC'
      when 'recibo_a' then 'RA' when 'recibo_b' then 'RB' when 'recibo_c' then 'RC'
      when 'recibo_x' then 'RX'
    end
  ) || '-' || c.numero::text;
$function$;

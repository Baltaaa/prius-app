-- Bug real (oct 2026): fn_recalcula_totales_caja actualizaba total_cobros y
-- total_gastos pero nunca total_neto — la UI de Caja.jsx lee esa columna
-- directo (no resumen_caja().totales.neto), así que mostraba un valor
-- arrastrado/viejo. Causa real del "Neto $9.942.000" reportado.
create or replace function public.fn_recalcula_totales_caja(p_caja_id uuid)
 returns void
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cobros numeric;
  v_gastos numeric;
begin
  if p_caja_id is null then return; end if;

  select coalesce(sum(monto), 0) into v_cobros
  from pagos where caja_id = p_caja_id and estado = 'vigente';

  select coalesce(sum(monto), 0) into v_gastos
  from gastos_caja where caja_id = p_caja_id and estado = 'vigente';

  update caja_diaria set total_cobros = v_cobros, total_gastos = v_gastos, total_neto = v_cobros - v_gastos
  where id = p_caja_id;
end;
$function$;

-- Recalcula ya mismo total_neto de todas las cajas desde el corte (las
-- anteriores quedan como estaban, son histórico pre-caja-digital).
do $$
declare v_id uuid;
begin
  for v_id in select id from caja_diaria where fecha >= fn_caja_inicio() loop
    perform fn_recalcula_totales_caja(v_id);
  end loop;
end $$;

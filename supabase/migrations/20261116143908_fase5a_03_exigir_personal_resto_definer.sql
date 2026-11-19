-- Fase 5A, Tarea 2: las SECURITY DEFINER que ya chequeaban rol también
-- arrancan con fn_exigir_personal() (respuesta uniforme 'no_autorizado'
-- para un cliente web). El chequeo de rol propio de cada una sigue igual.
do $do$
declare
  r record;
  d text;
  n int := 0;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname = any (array['mover_unidad_temporada','recepcion_cobrar','editar_gasto',
                                 'editar_monto_pago','fn_editar_pago_completo','guardar_categoria_gasto'])
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
  loop
    d := pg_get_functiondef(r.oid);
    continue when position('fn_exigir_personal' in d) > 0;
    d := regexp_replace(d, '^begin[ \t]*$', E'begin\n  perform public.fn_exigir_personal();', 'ni');
    if position('fn_exigir_personal' in d) = 0 then
      raise exception 'No encontré el begin principal de %', r.sig;
    end if;
    execute d;
    n := n + 1;
  end loop;
  if n <> 6 then
    raise exception 'Esperaba parchear 6 funciones y parché %', n;
  end if;
end
$do$;

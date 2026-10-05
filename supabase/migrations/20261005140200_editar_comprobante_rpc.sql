-- Ítem 4: cargar/corregir monto y fecha de un comprobante ya existente, sin
-- tocar caja_diaria ni el monto del pago — la UI solo compara y avisa si no
-- coinciden, nunca bloquea. Edición queda auditada en `eventos` sola, vía el
-- trigger de fn_log_evento sobre `comprobantes` (20261005140000), que guarda
-- before/after y el auth.uid() de quien lo hizo — no se necesita una tabla
-- de auditoría aparte para esto.
--
-- Rol: la matriz de permisos (lib/permisos.ts) no tiene hoy una clave para
-- "editar comprobante" — cae en el default "solo superadmin" de esa matriz,
-- así que acá se valida contra es_superadmin() (mismo patrón que
-- mover_unidad_temporada): un no-superadmin no puede ejecutar esto ni
-- llamando la RPC directo.
create or replace function public.editar_comprobante(
  p_comprobante_id uuid,
  p_monto numeric,
  p_fecha date default null
)
returns comprobantes
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_comprobante comprobantes;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.';
  end if;
  if not es_superadmin() then
    raise exception 'Esta acción requiere un usuario superadmin.';
  end if;
  if p_monto is not null and p_monto < 0 then
    raise exception 'El monto no puede ser negativo.';
  end if;

  update comprobantes
  set monto_total = p_monto, fecha = coalesce(p_fecha, fecha)
  where id = p_comprobante_id
  returning * into v_comprobante;

  if not found then
    raise exception 'El comprobante no existe.';
  end if;

  return v_comprobante;
end;
$function$;

revoke all on function public.editar_comprobante(uuid, numeric, date) from public, anon;
grant execute on function public.editar_comprobante(uuid, numeric, date) to authenticated;

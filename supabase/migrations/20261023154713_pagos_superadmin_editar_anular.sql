-- Testing 23/10/2026, items 9 y 10: editar monto/tipo de comprobante, anular
-- y eliminar pagos quedan restringidos a superadmin — reforzado en el
-- servidor, no solo en el front. Aditivo: no se toca ningún dato existente.
--
-- "Eliminar pago" (hard delete) NO se implementa acá a propósito: contradice
-- el principio ya documentado en CLAUDE.md ("Borrado de datos raíz" / flujo
-- de dinero — "Nada se borra: pagos y gastos se anulan con motivo"). Anular
-- (ya con motivo auditado) es la forma real de "borrar" un pago en este
-- sistema; se deja anotado en el reporte de la tarea para que el dueño
-- confirme si de verdad quiere un hard-delete de un registro de dinero.

-- 1) anular_pago: no tenía ningún chequeo de rol — cualquier usuario
--    autenticado podía anular un pago. Ahora exige superadmin, igual que
--    editar_comprobante.
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns pagos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pago pagos;
  v_caja caja_diaria;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if not es_superadmin() then
    raise exception 'Esta acción requiere un usuario superadmin.' using errcode = '42501';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'El motivo de anulación es obligatorio.'; end if;

  select * into v_pago from pagos where id = p_pago_id;
  if not found then raise exception 'El pago no existe.'; end if;
  if v_pago.estado = 'anulado' then raise exception 'El pago ya está anulado.'; end if;

  if v_pago.caja_id is not null then
    select * into v_caja from caja_diaria where id = v_pago.caja_id;
    if v_caja.estado <> 'abierta' then
      raise exception 'La caja de este pago está cerrada: hay que reabrirla para anularlo.';
    end if;
  end if;

  update pagos set estado = 'anulado', anulado_motivo = p_motivo, anulado_por = auth.uid(), anulado_at = now()
  where id = p_pago_id returning * into v_pago;

  if v_pago.comprobante_id is not null
     and not exists (select 1 from pagos where comprobante_id = v_pago.comprobante_id and estado = 'vigente') then
    update comprobantes set estado = 'anulado' where id = v_pago.comprobante_id;
  end if;

  insert into caja_eventos (caja_id, tipo, detalle, usuario)
  select v_pago.caja_id, 'anulacion_pago', jsonb_build_object('pago_id', p_pago_id, 'motivo', p_motivo), auth.uid()
  where v_pago.caja_id is not null;

  return v_pago;
end;
$function$;

-- 2) editar_comprobante: sumaba p_tipo (RB, FB, etc.) — antes solo corregía
--    monto/fecha. Mismo guard de superadmin que ya tenía. Se recrea con una
--    firma distinta (4 parámetros en vez de 3), por eso el drop explícito de
--    la versión vieja antes de crear la nueva — evita que convivan dos
--    overloads y un llamado ambiguo.
drop function if exists public.editar_comprobante(uuid, numeric, date);

create or replace function public.editar_comprobante(
  p_comprobante_id uuid,
  p_monto numeric,
  p_fecha date default null,
  p_tipo text default null
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
    raise exception 'Esta acción requiere un usuario superadmin.' using errcode = '42501';
  end if;
  if p_monto is not null and p_monto < 0 then
    raise exception 'El monto no puede ser negativo.';
  end if;

  update comprobantes
  set monto_total = p_monto,
      fecha = coalesce(p_fecha, fecha),
      tipo = coalesce(p_tipo, tipo)
  where id = p_comprobante_id
  returning * into v_comprobante;

  if not found then
    raise exception 'El comprobante no existe.';
  end if;

  return v_comprobante;
exception
  when unique_violation then
    raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then
    raise exception 'Ese tipo de comprobante no es válido.';
end;
$function$;

grant execute on function public.editar_comprobante(uuid, numeric, date, text) to authenticated;

-- 3) fn_editar_monto_pago_vigente: NUEVA — corrige el monto de un pago YA
--    verificado (editar_monto_pago, distinto y deliberadamente compartido
--    con admin, es solo para CARGAR el monto de un recibo migrado que
--    todavía está en null — ver su propio comentario en el código). Esta es
--    superadmin-only, dispara los mismos triggers de siempre
--    (fn_pago_actualiza_saldo / fn_recalcula_totales_caja vía el UPDATE),
--    sin lógica de escritura paralela.
create or replace function public.fn_editar_monto_pago_vigente(p_pago_id uuid, p_monto numeric)
returns pagos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pago pagos;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if not es_superadmin() then
    raise exception 'Esta acción requiere un usuario superadmin.' using errcode = '42501';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá un monto válido.';
  end if;

  select * into v_pago from pagos where id = p_pago_id;
  if not found then raise exception 'El pago no existe.'; end if;
  if v_pago.estado = 'anulado' then raise exception 'Este pago está anulado — no se puede editar.'; end if;

  update pagos set monto = round(p_monto), monto_pendiente_verificacion = false
  where id = p_pago_id
  returning * into v_pago;

  if v_pago.caja_id is not null then
    perform fn_recalcula_totales_caja(v_pago.caja_id);
  end if;

  return v_pago;
end;
$function$;

grant execute on function public.fn_editar_monto_pago_vigente(uuid, numeric) to authenticated;

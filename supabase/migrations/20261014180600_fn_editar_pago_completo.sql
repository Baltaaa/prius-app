-- Oct 2026 (modal "Pago N.º X" → Cargar monto con datos completos): UPDATE
-- sobre un pago YA existente, nunca INSERT — reusa fn_vincular_comprobante
-- pasando el p_pago_id REAL de la fila que se edita (ese es justo el bug
-- conocido "comprobante sin vincular con 409": pasarle un id de pago
-- equivocado hace que fn_vincular_comprobante vea el comprobante existente
-- como "de otro pago" y tire la excepción). La fecha elegida define también
-- a qué caja se imputa el movimiento (histórica = ninguna, igual que un
-- alta nueva vía fn_registrar_pago_interno) — nunca se imputa a la caja de
-- hoy por default.
create or replace function fn_editar_pago_completo(
  p_pago_id uuid,
  p_monto numeric,
  p_medio text,
  p_tipo_pago text,
  p_fecha date,
  p_comprobante jsonb default null
)
returns pagos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago pagos;
  v_caja_id uuid;
  v_comprobante_id uuid;
begin
  if not es_admin() then
    raise exception 'No tenés permiso para editar este pago.' using errcode = '42501';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá un monto válido.';
  end if;
  if p_fecha is null then
    raise exception 'Elegí una fecha para el pago.';
  end if;

  select * into v_pago from pagos where id = p_pago_id;
  if not found then
    raise exception 'El pago no existe.';
  end if;
  if v_pago.estado = 'anulado' then
    raise exception 'Este pago está anulado — no se puede editar.';
  end if;

  if p_fecha < fn_caja_inicio() then
    v_caja_id := null;
  else
    select id into v_caja_id from caja_diaria where estado = 'abierta';
    if v_caja_id is null then
      raise exception 'La caja está cerrada: abrí la caja para imputar este cobro a la fecha elegida.' using errcode = 'P0003';
    end if;
  end if;

  update pagos
  set monto = round(p_monto),
      monto_pendiente_verificacion = false,
      medio = p_medio,
      tipo_pago = p_tipo_pago,
      fecha = p_fecha,
      caja_id = v_caja_id
  where id = p_pago_id
  returning * into v_pago;

  if p_comprobante is not null then
    if p_comprobante ? 'comprobante_id' then
      v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
      update comprobantes set pago_id = p_pago_id where id = v_comprobante_id and (pago_id is null or pago_id = p_pago_id);
    else
      v_comprobante_id := fn_vincular_comprobante(
        p_comprobante->>'tipo',
        (p_comprobante->>'punto_venta')::integer,
        p_comprobante->>'numero',
        coalesce((p_comprobante->>'fecha')::date, p_fecha),
        v_pago.cliente_id,
        p_pago_id
      );
    end if;
    update pagos set comprobante_id = v_comprobante_id where id = p_pago_id returning * into v_pago;
    update comprobantes set monto_total = (
      select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
    ) where id = v_comprobante_id;
  end if;

  return v_pago;
exception
  when sqlstate 'P0003' then raise;
  when unique_violation then raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then raise exception 'Los datos del pago o el comprobante no son válidos.';
end;
$$;

revoke all on function fn_editar_pago_completo(uuid, numeric, text, text, date, jsonb) from public;
grant execute on function fn_editar_pago_completo(uuid, numeric, text, text, date, jsonb) to authenticated;

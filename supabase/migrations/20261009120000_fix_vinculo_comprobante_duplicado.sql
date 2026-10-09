-- Bug real (oct 2026, QA): registrar un pago con comprobante nuevo (ej.
-- transferencia, RX, PV 1, N° 888) podía dejar el comprobante sin vincular
-- al pago (pagos.comprobante_id null), y el reintento desde "Cargar" en
-- DetallePago (completar_comprobante) fallaba con 409 crudo de Postgres por
-- la unique (tipo, punto_venta, numero) — ya existía la fila, pero la
-- función no sabía qué hacer con eso, solo explotaba.
--
-- registrar_pago/fn_registrar_pago_interno y completar_comprobante ya son
-- transaccionales (una sola función PL/pgSQL = una sola transacción
-- implícita por llamada RPC: cualquier excepción no atrapada deshace TODO
-- lo hecho en esa llamada, comprobante incluido) — el problema no era falta
-- de atomicidad, sino que un reintento (doble submit, UI que no refrescó a
-- tiempo, etc.) contra un comprobante ya insertado chocaba con la unique
-- constraint y no tenía ningún manejo: ni vincular la fila existente si
-- estaba libre, ni un mensaje claro si ya pertenecía a otro pago.
--
-- fn_vincular_comprobante centraliza esa lógica (inserta; si choca con la
-- unique, vincula la fila existente si está libre, o lanza un error legible
-- si ya es de otro pago) para que completar_comprobante y
-- fn_registrar_pago_interno no la reimplementen cada una por su lado — el
-- mismo patrón "single write" que ya usa el resto de la base.
create or replace function public.fn_vincular_comprobante(
  p_tipo text,
  p_punto_venta integer,
  p_numero text,
  p_fecha date,
  p_cliente_id uuid,
  p_pago_id uuid
)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_comprobante_id uuid;
  v_existente comprobantes;
  v_razon_social text;
  v_cuit text;
  v_condicion text;
begin
  select razon_social, cuit, condicion_iva into v_razon_social, v_cuit, v_condicion
  from clientes where id = p_cliente_id;

  begin
    insert into comprobantes (
      tipo, punto_venta, numero, fecha, cliente_id, razon_social, cuit, condicion_iva, monto_total, pago_id
    ) values (
      p_tipo, coalesce(p_punto_venta, 1), p_numero, p_fecha, p_cliente_id, v_razon_social, v_cuit,
      coalesce(v_condicion, 'consumidor_final'), 0, p_pago_id
    )
    returning id into v_comprobante_id;
  exception when unique_violation then
    select * into v_existente from comprobantes
    where tipo = p_tipo and punto_venta = coalesce(p_punto_venta, 1) and numero = p_numero;

    if not found then
      raise; -- colisión contra otra constraint: no la enmascaramos, se propaga tal cual
    end if;

    if v_existente.pago_id is not null and v_existente.pago_id <> p_pago_id then
      raise exception 'Ya existe un comprobante % cargado en otro pago.', fn_comprobante_etiqueta(v_existente)
        using errcode = 'P0004';
    end if;

    update comprobantes set pago_id = p_pago_id where id = v_existente.id;
    v_comprobante_id := v_existente.id;
  end;

  return v_comprobante_id;
end;
$function$;

revoke all on function public.fn_vincular_comprobante(text, integer, text, date, uuid, uuid) from public, anon, authenticated;

-- completar_comprobante: usa el helper para el caso "comprobante nuevo", y
-- para el caso "reusar comprobante_id existente" (feature "mismo
-- comprobante") ahora sí chequea si la fila quedó vinculada — antes, si la
-- fila ya pertenecía a otro pago, el `update ... where pago_id is null`
-- actualizaba 0 filas en silencio y la función igual seguía de largo,
-- pisando pagos.comprobante_id con un id que en comprobantes seguía
-- apuntando al pago viejo.
create or replace function public.completar_comprobante(p_pago_id uuid, p_comprobante jsonb)
 returns pagos
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pago pagos;
  v_comprobante_id uuid;
  v_existente comprobantes;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  select * into v_pago from pagos where id = p_pago_id;
  if not found then raise exception 'El pago no existe.'; end if;

  if p_comprobante ? 'comprobante_id' then
    v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
    update comprobantes set pago_id = p_pago_id where id = v_comprobante_id and pago_id is null;
    if not found then
      select * into v_existente from comprobantes where id = v_comprobante_id;
      if not found then
        raise exception 'El comprobante no existe.';
      end if;
      if v_existente.pago_id is distinct from p_pago_id then
        raise exception 'Ya existe un comprobante % cargado en otro pago.', fn_comprobante_etiqueta(v_existente)
          using errcode = 'P0004';
      end if;
    end if;
  else
    v_comprobante_id := fn_vincular_comprobante(
      p_comprobante->>'tipo',
      (p_comprobante->>'punto_venta')::integer,
      p_comprobante->>'numero',
      coalesce((p_comprobante->>'fecha')::date, current_date),
      v_pago.cliente_id,
      p_pago_id
    );
  end if;

  update pagos set comprobante_id = v_comprobante_id where id = p_pago_id returning * into v_pago;
  update comprobantes set monto_total = (
    select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
  ) where id = v_comprobante_id;

  insert into caja_eventos (caja_id, tipo, detalle, usuario)
  select v_pago.caja_id, 'anulacion_pago', jsonb_build_object('accion','completar_comprobante','pago_id',p_pago_id), auth.uid()
  where v_pago.caja_id is not null;

  return v_pago;
exception
  when sqlstate 'P0004' then
    raise;
  when unique_violation then
    raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then
    raise exception 'Los datos del comprobante no son válidos.';
  when foreign_key_violation then
    raise exception 'El cliente asociado no existe.';
end;
$function$;

-- fn_registrar_pago_interno: mismo helper para el alta de comprobante nuevo
-- (antes insertaba directo, sin ningún manejo de colisión) + mapeo de
-- errores crudos de Postgres a mensajes en español, para que un reintento
-- o un dato inconsistente nunca muestre el texto técnico de la base.
create or replace function public.fn_registrar_pago_interno(
  p_reserva_id uuid,
  p_cliente_id uuid,
  p_monto numeric,
  p_medio text,
  p_tipo_pago text,
  p_concepto text,
  p_referencia text,
  p_comprobante jsonb,
  p_permitir_excedente boolean,
  p_fecha date default current_date
)
returns pagos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
  v_caja_id uuid;
  v_comprobante_id uuid;
  v_pago pagos;
  v_pagado numeric;
  v_fecha date := coalesce(p_fecha, current_date);
  v_historico boolean := v_fecha < fn_caja_inicio();
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a 0.';
  end if;

  if p_reserva_id is not null then
    select * into v_reserva from reservas where id = p_reserva_id;
    if not found then raise exception 'La reserva no existe.'; end if;
    if v_reserva.bonificada then
      raise exception 'La reserva está bonificada: no admite pagos.';
    end if;
    select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = p_reserva_id and estado = 'vigente';
    if not p_permitir_excedente and (v_pagado + p_monto) > coalesce(v_reserva.valor_total, 0) then
      raise exception 'El monto supera el saldo de la reserva (saldo actual: %). Confirmá el excedente para continuar.', greatest(coalesce(v_reserva.valor_total,0) - v_pagado, 0)
        using errcode = 'P0002';
    end if;
  end if;

  if v_historico then
    -- Pago histórico: nunca pasa por caja, no exige una abierta.
    v_caja_id := null;
  else
    select id into v_caja_id from caja_diaria where estado = 'abierta';
    if v_caja_id is null then
      raise exception 'La caja está cerrada: abrí la caja para registrar el cobro.' using errcode = 'P0003';
    end if;
  end if;

  -- El pago se inserta primero (sin comprobante_id): fn_vincular_comprobante
  -- necesita un pago_id real para decidir si una fila existente es "de este
  -- pago" o "de otro pago" — con null ahí esa comparación no tiene sentido.
  insert into pagos (
    reserva_id, cliente_id, caja_id, monto, medio, tipo_pago, concepto, referencia,
    comprobante_id, origen, estado, registrado_por, fecha
  ) values (
    p_reserva_id, p_cliente_id, v_caja_id, p_monto, p_medio, p_tipo_pago, p_concepto, p_referencia,
    null, 'crm', 'vigente', auth.uid(), v_fecha
  ) returning * into v_pago;

  if p_comprobante is not null then
    if p_comprobante ? 'comprobante_id' then
      v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
      update comprobantes set pago_id = v_pago.id where id = v_comprobante_id and pago_id is null;
      if not found then
        raise exception 'El comprobante no existe o ya está cargado en otro pago.';
      end if;
    else
      v_comprobante_id := fn_vincular_comprobante(
        p_comprobante->>'tipo',
        (p_comprobante->>'punto_venta')::integer,
        p_comprobante->>'numero',
        coalesce((p_comprobante->>'fecha')::date, v_fecha),
        p_cliente_id,
        v_pago.id
      );
    end if;

    update pagos set comprobante_id = v_comprobante_id where id = v_pago.id returning * into v_pago;
    update comprobantes set monto_total = (
      select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
    ) where id = v_comprobante_id;
  end if;

  return v_pago;
exception
  when sqlstate 'P0002' or sqlstate 'P0003' or sqlstate 'P0004' then
    raise;
  when unique_violation then
    raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then
    raise exception 'Los datos del pago o el comprobante no son válidos.';
  when foreign_key_violation then
    raise exception 'El cliente o la reserva asociada no existe.';
end;
$function$;

revoke execute on function public.fn_registrar_pago_interno(uuid, uuid, numeric, text, text, text, text, jsonb, boolean, date) from public;

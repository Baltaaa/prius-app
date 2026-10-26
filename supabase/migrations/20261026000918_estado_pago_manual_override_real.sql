-- Item 2 (25/10/2026): revertir/editar el estado de pago de una reserva a
-- mano, solo superadmin. Auditoría previa: reservas.estado_pago se deriva
-- SIEMPRE de pagos vía dos triggers — fn_pago_actualiza_saldo (AFTER en
-- pagos, dispara un UPDATE en reservas) y fn_reserva_recalcula_saldo
-- (BEFORE INSERT/UPDATE en reservas, recalcula saldo/estado_pago desde
-- cero en cada escritura de la fila, incluida la que dispara el trigger de
-- arriba). Cualquier UPDATE directo de estado_pago quedaría pisado al
-- instante por este segundo trigger si no se lo enseña a respetar un
-- override activo.
--
-- Diseño: 4 columnas nuevas, aditivas. Cambio a 'pagado' o a otro estado
-- por decisión del dueño/superadmin, no borra ni toca pagos/comprobantes.
-- Criterio de reversión automática: un pago NUEVO (INSERT en pagos) sobre
-- esa reserva limpia el override y vuelve al cálculo automático — un pago
-- nuevo es la señal más fuerte de que la situación de plata cambió y el
-- ajuste manual ya no aplica; un superadmin también puede quitarlo a mano
-- en cualquier momento (revertir_estado_pago_automatico). Editar/anular un
-- pago YA existente NO limpia el override (no es "plata nueva", podría ser
-- solo una corrección de monto/comprobante).

-- 0) fn_fmt_pesos: helper de formato ($ 1.089.000) para las descripciones
--    que arma fn_log_evento más abajo — ítem 4 (25/10/2026): esas
--    descripciones embebían el monto crudo de Postgres ($85000, sin
--    separador de miles) directo en el texto. Mismo criterio de
--    presentación que formatPesos() del front (src/lib/format.ts), para
--    que lo que ve el dueño en Historial no dependa de qué lado lo generó.
create or replace function public.fn_fmt_pesos(p_monto numeric)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select '$ ' || replace(to_char(round(coalesce(p_monto, 0))::bigint, 'FM999,999,999,999'), ',', '.');
$function$;

alter table public.reservas
  add column if not exists estado_pago_manual boolean not null default false,
  add column if not exists estado_pago_manual_motivo text,
  add column if not exists estado_pago_manual_por uuid,
  add column if not exists estado_pago_manual_at timestamptz;

comment on column public.reservas.estado_pago_manual is 'Override manual (solo superadmin) del estado_pago calculado — ver cambiar_estado_pago_manual/revertir_estado_pago_automatico.';

-- 1) fn_reserva_recalcula_saldo: saldo SIEMPRE se recalcula desde pagos (es
--    la verdad del dinero); estado_pago solo se recalcula cuando no hay
--    override activo. Si el UPDATE que dispara este trigger es el que
--    activa el override (estado_pago_manual pasa a true en el mismo
--    UPDATE), new.estado_pago ya trae el valor elegido por el superadmin y
--    el trigger no lo toca.
create or replace function public.fn_reserva_recalcula_saldo()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_pagos_reales integer;
  v_sin_monto integer;
  v_pagado numeric;
  v_saldo numeric;
  v_total numeric;
begin
  if new.bonificada then
    if exists (select 1 from pagos where reserva_id = new.id and estado = 'vigente') then
      raise exception 'No se puede marcar como bonificada: la reserva ya tiene pagos registrados.';
    end if;
    new.valor_total := 0;
    new.saldo := 0;
    new.estado_pago := 'pagado';
    new.estado_pago_manual := false;
    new.estado_pago_manual_motivo := null;
    new.estado_pago_manual_por := null;
    new.estado_pago_manual_at := null;
    return new;
  end if;

  if new.grupo_id is not null then
    select precio_total into v_total from reserva_grupos where id = new.grupo_id;
    select
      count(*) filter (where fn_pago_es_real(p.id, p.monto)),
      count(*) filter (where fn_pago_es_real(p.id, p.monto) and p.monto is null),
      coalesce(sum(p.monto) filter (where fn_pago_es_real(p.id, p.monto)), 0)
      into v_pagos_reales, v_sin_monto, v_pagado
      from pagos p
      where p.estado = 'vigente' and p.reserva_id in (
        select id from reservas where grupo_id = new.grupo_id
        union select new.id
      );
    if v_pagos_reales = 0 then
      new.saldo := v_total;
      if not new.estado_pago_manual then new.estado_pago := 'pendiente'; end if;
    elsif v_sin_monto > 0 then
      new.saldo := null;
      if not new.estado_pago_manual then new.estado_pago := 'parcial'; end if;
    else
      v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
      new.saldo := v_saldo;
      if not new.estado_pago_manual then
        new.estado_pago := case when v_saldo <= 0 then 'pagado' else 'parcial' end;
      end if;
      if new.origen = 'web' and v_saldo <= 0 then new.preconfirmada := false; end if;
    end if;
    return new;
  end if;

  select
    count(*) filter (where fn_pago_es_real(p.id, p.monto)),
    count(*) filter (where fn_pago_es_real(p.id, p.monto) and p.monto is null),
    coalesce(sum(p.monto) filter (where fn_pago_es_real(p.id, p.monto)), 0)
    into v_pagos_reales, v_sin_monto, v_pagado
    from pagos p where p.reserva_id = new.id and p.estado = 'vigente';

  if v_pagos_reales = 0 then
    new.saldo := coalesce(new.valor_total, 0);
    if not new.estado_pago_manual then new.estado_pago := 'pendiente'; end if;
  elsif v_sin_monto > 0 then
    new.saldo := null;
    if not new.estado_pago_manual then new.estado_pago := 'parcial'; end if;
  else
    v_saldo := greatest(coalesce(new.valor_total, 0) - v_pagado, 0);
    new.saldo := v_saldo;
    if not new.estado_pago_manual then
      new.estado_pago := case when v_saldo <= 0 then 'pagado' else 'parcial' end;
    end if;
    if new.origen = 'web' and v_saldo <= 0 then new.preconfirmada := false; end if;
  end if;

  return new;
end;
$function$;

-- 2) fn_pago_actualiza_saldo: cuando hay override activo y esta ejecución
--    NO es un pago nuevo (TG_OP <> 'INSERT'), solo toca `saldo` — nunca
--    propone un estado_pago nuevo, así el BEFORE trigger de arriba no tiene
--    nada que "dejar pasar": la fila nunca sale del override. Cuando SÍ es
--    un pago nuevo sobre una reserva con override activo, limpia las 4
--    columnas en el mismo UPDATE — el BEFORE trigger ve
--    estado_pago_manual = false entrando y recalcula normal.
create or replace function public.fn_pago_actualiza_saldo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reserva_id uuid;
  v_grupo_id uuid;
  v_total numeric;
  v_pagos_reales integer;
  v_sin_monto integer;
  v_pagado numeric;
  v_saldo numeric;
  v_manual_activo boolean;
  v_limpia_manual boolean;
begin
  v_reserva_id := coalesce(new.reserva_id, old.reserva_id);
  if v_reserva_id is null then
    return coalesce(new, old);
  end if;

  select grupo_id, estado_pago_manual into v_grupo_id, v_manual_activo from reservas where id = v_reserva_id;
  v_limpia_manual := (TG_OP = 'INSERT' and coalesce(v_manual_activo, false));

  if v_grupo_id is not null then
    select precio_total into v_total from reserva_grupos where id = v_grupo_id;
    select
      count(*) filter (where fn_pago_es_real(p.id, p.monto)),
      count(*) filter (where fn_pago_es_real(p.id, p.monto) and p.monto is null),
      coalesce(sum(p.monto) filter (where fn_pago_es_real(p.id, p.monto)), 0)
      into v_pagos_reales, v_sin_monto, v_pagado
      from pagos p join reservas r on r.id = p.reserva_id
      where r.grupo_id = v_grupo_id and p.estado = 'vigente';

    if v_manual_activo and not v_limpia_manual then
      if v_pagos_reales = 0 then
        update reservas set saldo = v_total where grupo_id = v_grupo_id;
      elsif v_sin_monto > 0 then
        update reservas set saldo = null where grupo_id = v_grupo_id;
      else
        update reservas set saldo = greatest(coalesce(v_total, 0) - v_pagado, 0) where grupo_id = v_grupo_id;
      end if;
      return coalesce(new, old);
    end if;

    if v_pagos_reales = 0 then
      update reservas set saldo = v_total, estado_pago = 'pendiente',
        estado_pago_manual = false, estado_pago_manual_motivo = null, estado_pago_manual_por = null, estado_pago_manual_at = null
      where grupo_id = v_grupo_id;
    elsif v_sin_monto > 0 then
      update reservas set saldo = null, estado_pago = 'parcial',
        estado_pago_manual = false, estado_pago_manual_motivo = null, estado_pago_manual_por = null, estado_pago_manual_at = null
      where grupo_id = v_grupo_id;
    else
      v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
      update reservas set
        saldo = v_saldo,
        estado_pago = case when v_saldo <= 0 then 'pagado' else 'parcial' end,
        preconfirmada = case when origen = 'web' and v_saldo <= 0 then false else preconfirmada end,
        estado_pago_manual = false, estado_pago_manual_motivo = null, estado_pago_manual_por = null, estado_pago_manual_at = null
      where grupo_id = v_grupo_id;
    end if;
    return coalesce(new, old);
  end if;

  select valor_total into v_total from reservas where id = v_reserva_id;
  if not found then
    return coalesce(new, old);
  end if;

  select
    count(*) filter (where fn_pago_es_real(p.id, p.monto)),
    count(*) filter (where fn_pago_es_real(p.id, p.monto) and p.monto is null),
    coalesce(sum(p.monto) filter (where fn_pago_es_real(p.id, p.monto)), 0)
    into v_pagos_reales, v_sin_monto, v_pagado
    from pagos p where p.reserva_id = v_reserva_id and p.estado = 'vigente';

  if v_manual_activo and not v_limpia_manual then
    if v_pagos_reales = 0 then
      update reservas set saldo = coalesce(v_total, 0) where id = v_reserva_id;
    elsif v_sin_monto > 0 then
      update reservas set saldo = null where id = v_reserva_id;
    else
      update reservas set saldo = greatest(coalesce(v_total, 0) - v_pagado, 0) where id = v_reserva_id;
    end if;
    return coalesce(new, old);
  end if;

  if v_pagos_reales = 0 then
    update reservas set saldo = coalesce(v_total, 0), estado_pago = 'pendiente',
      estado_pago_manual = false, estado_pago_manual_motivo = null, estado_pago_manual_por = null, estado_pago_manual_at = null
    where id = v_reserva_id;
  elsif v_sin_monto > 0 then
    update reservas set saldo = null, estado_pago = 'parcial',
      estado_pago_manual = false, estado_pago_manual_motivo = null, estado_pago_manual_por = null, estado_pago_manual_at = null
    where id = v_reserva_id;
  else
    v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
    update reservas set
      saldo = v_saldo,
      estado_pago = case when v_saldo <= 0 then 'pagado' else 'parcial' end,
      preconfirmada = case when origen = 'web' and v_saldo <= 0 then false else preconfirmada end,
      estado_pago_manual = false, estado_pago_manual_motivo = null, estado_pago_manual_por = null, estado_pago_manual_at = null
    where id = v_reserva_id;
  end if;

  return coalesce(new, old);
end;
$function$;

-- 3) RPC cambiar_estado_pago_manual: activa/actualiza el override.
create or replace function public.cambiar_estado_pago_manual(p_reserva_id uuid, p_nuevo_estado text, p_motivo text)
returns reservas
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if not es_superadmin() then
    raise exception 'Esta acción requiere un usuario superadmin.' using errcode = '42501';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo del ajuste es obligatorio.';
  end if;
  if p_nuevo_estado not in ('pendiente', 'parcial', 'pagado', 'pendiente_confirmacion') then
    raise exception 'Estado de pago inválido: %', p_nuevo_estado;
  end if;

  select * into v_reserva from reservas where id = p_reserva_id;
  if not found then raise exception 'La reserva no existe.'; end if;
  if v_reserva.bonificada then
    raise exception 'La reserva está bonificada: su estado de pago no se puede ajustar a mano.';
  end if;

  update reservas set
    estado_pago = p_nuevo_estado,
    estado_pago_manual = true,
    estado_pago_manual_motivo = btrim(p_motivo),
    estado_pago_manual_por = auth.uid(),
    estado_pago_manual_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  return v_reserva;
end;
$function$;

grant execute on function public.cambiar_estado_pago_manual(uuid, text, text) to authenticated;

-- 4) RPC revertir_estado_pago_automatico: apaga el override; el BEFORE
--    trigger recalcula estado_pago desde pagos en el mismo UPDATE.
create or replace function public.revertir_estado_pago_automatico(p_reserva_id uuid)
returns reservas
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if not es_superadmin() then
    raise exception 'Esta acción requiere un usuario superadmin.' using errcode = '42501';
  end if;

  select * into v_reserva from reservas where id = p_reserva_id;
  if not found then raise exception 'La reserva no existe.'; end if;
  if not v_reserva.estado_pago_manual then
    raise exception 'Esta reserva no tiene un ajuste manual activo.';
  end if;

  update reservas set
    estado_pago_manual = false,
    estado_pago_manual_motivo = null,
    estado_pago_manual_por = null,
    estado_pago_manual_at = null
  where id = p_reserva_id
  returning * into v_reserva;

  return v_reserva;
end;
$function$;

grant execute on function public.revertir_estado_pago_automatico(uuid) to authenticated;

-- 5) fn_log_evento: descripción propia para el ajuste manual (en vez de
--    caer en el genérico "Reserva editada") — va antes del resto de ramas
--    de reservas para no competir con ellas. De paso (ítem 4), cambia
--    format('$%s', ...) por fn_fmt_pesos(...) en todas las descripciones
--    que embeben montos (pagos, gastos, caja) para que Historial deje de
--    mostrar cifras sin separador de miles.
create or replace function public.fn_log_evento()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new   jsonb;
  v_old   jsonb;
  v_fecha date;
  v_desc  text;
  v_tipo  text;
  v_id    uuid;
  v_actor_nombre text;
  v_cliente_id uuid;
  v_cliente_nombre text;
  v_origen text;
begin
  v_new := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end;
  v_old := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end;
  v_id  := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);

  select nombre into v_actor_nombre from perfiles where user_id = auth.uid();

  if v_actor_nombre is null and auth.uid() is null then
    v_origen := coalesce(v_new->>'origen', v_old->>'origen');
    if v_origen = 'web' or TG_TABLE_NAME in ('codigos_reserva', 'leads') then
      v_actor_nombre := 'Web (cliente)';
    else
      v_actor_nombre := 'Sistema';
    end if;
  end if;

  if TG_TABLE_NAME = 'reservas' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_new->>'fecha_inicio')::date, (v_old->>'fecha')::date, (v_old->>'fecha_inicio')::date, current_date);
    v_cliente_id := coalesce((v_new->>'cliente_id')::uuid, (v_old->>'cliente_id')::uuid);
    if TG_OP = 'INSERT' then
      v_tipo := 'reserva_alta'; v_desc := format('Reserva nueva — %s', coalesce(v_new->>'tipo_alquiler', 's/tipo'));
    elsif TG_OP = 'DELETE' then
      v_tipo := 'reserva_eliminada'; v_desc := 'Reserva eliminada';
    elsif v_new->>'estado' = 'cancelada' and v_old->>'estado' is distinct from v_new->>'estado' then
      v_tipo := 'reserva_cancelada'; v_desc := 'Reserva cancelada';
    elsif (v_old->>'estado_pago_manual') is distinct from (v_new->>'estado_pago_manual') and (v_new->>'estado_pago_manual') = 'true' then
      v_tipo := 'estado_pago_manual'; v_desc := format('Ajustó el estado de pago a mano: %s → %s — %s', v_old->>'estado_pago', v_new->>'estado_pago', coalesce(v_new->>'estado_pago_manual_motivo', 's/motivo'));
    elsif (v_old->>'estado_pago_manual') is distinct from (v_new->>'estado_pago_manual') and (v_new->>'estado_pago_manual') = 'false' then
      v_tipo := 'estado_pago_manual_revertido'; v_desc := 'Volvió el estado de pago al cálculo automático';
    elsif v_old->>'unidad_id' is distinct from v_new->>'unidad_id' then
      v_tipo := 'cambio_unidad'; v_desc := 'Cambio de unidad';
    elsif v_old->>'notas' is distinct from v_new->>'notas' then
      v_tipo := 'nota'; v_desc := 'Nota actualizada';
    else
      v_tipo := 'reserva_editada'; v_desc := 'Reserva editada';
    end if;

  elsif TG_TABLE_NAME = 'pagos' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_old->>'fecha')::date, current_date);
    v_cliente_id := coalesce((v_new->>'cliente_id')::uuid, (v_old->>'cliente_id')::uuid);
    if TG_OP = 'INSERT' then
      v_tipo := 'pago'; v_desc := format('Pago registrado — %s %s', fn_fmt_pesos((v_new->>'monto')::numeric), coalesce(v_new->>'medio', ''));
    elsif TG_OP = 'DELETE' then
      v_tipo := 'pago_eliminado'; v_desc := 'Pago eliminado';
    elsif v_old->>'estado' is distinct from v_new->>'estado' and v_new->>'estado' = 'anulado' then
      v_tipo := 'anulacion'; v_desc := format('Pago anulado — %s', fn_fmt_pesos((v_old->>'monto')::numeric));
    else
      v_tipo := 'pago_editado'; v_desc := format('Pago editado — %s', fn_fmt_pesos((v_new->>'monto')::numeric));
    end if;

  elsif TG_TABLE_NAME = 'comprobantes' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_old->>'fecha')::date, current_date);
    if TG_OP = 'INSERT' then
      v_tipo := 'comprobante'; v_desc := format('Comprobante cargado — %s %s', v_new->>'tipo', v_new->>'numero');
    elsif TG_OP = 'DELETE' then
      v_tipo := 'comprobante_eliminado'; v_desc := 'Comprobante eliminado';
    else
      v_tipo := 'comprobante_editado'; v_desc := format('Comprobante editado — %s %s', v_new->>'tipo', v_new->>'numero');
    end if;

  elsif TG_TABLE_NAME = 'clientes' then
    v_fecha := coalesce(((v_new->>'created_at')::timestamptz)::date, ((v_old->>'created_at')::timestamptz)::date, current_date);
    v_cliente_id := v_id;
    if TG_OP = 'INSERT' then
      v_tipo := 'cliente_alta'; v_desc := format('Cliente nuevo — %s', v_new->>'nombre');
    elsif TG_OP = 'DELETE' then
      v_tipo := 'cliente_eliminado'; v_desc := format('Cliente eliminado — %s', v_old->>'nombre');
    else
      v_tipo := 'cliente_editado'; v_desc := format('Cliente editado — %s', v_new->>'nombre');
    end if;

  elsif TG_TABLE_NAME = 'unidades' then
    if TG_OP = 'UPDATE' and v_new->>'estado' is not distinct from v_old->>'estado' then
      return null;
    end if;
    v_fecha := current_date;
    v_tipo := 'unidad_estado';
    v_desc := format('Unidad %s #%s → %s', v_new->>'tipo', v_new->>'numero', v_new->>'estado');

  elsif TG_TABLE_NAME = 'gastos_caja' then
    v_fecha := current_date;
    if TG_OP = 'INSERT' then
      v_tipo := 'gasto'; v_desc := format('Gasto registrado — %s %s', fn_fmt_pesos((v_new->>'monto')::numeric), coalesce(v_new->>'descripcion', ''));
    elsif v_old->>'estado' is distinct from v_new->>'estado' and v_new->>'estado' = 'anulado' then
      v_tipo := 'gasto_anulado'; v_desc := format('Gasto anulado — %s', fn_fmt_pesos((v_old->>'monto')::numeric));
    else
      v_tipo := 'gasto_editado'; v_desc := format('Gasto editado — %s', fn_fmt_pesos((v_new->>'monto')::numeric));
    end if;

  elsif TG_TABLE_NAME = 'reserva_clientes' then
    v_fecha := current_date;
    v_cliente_id := coalesce((v_new->>'cliente_id')::uuid, (v_old->>'cliente_id')::uuid);
    if TG_OP = 'INSERT' then
      v_tipo := 'co_socio_agregado'; v_desc := 'Co-socio agregado a una reserva';
    else
      v_tipo := 'co_socio_quitado'; v_desc := 'Co-socio quitado de una reserva';
    end if;

  elsif TG_TABLE_NAME = 'caja_diaria' then
    v_fecha := coalesce((v_new->>'fecha')::date, (v_old->>'fecha')::date, current_date);
    if TG_OP = 'INSERT' then
      v_tipo := 'caja_apertura'; v_desc := format('Caja abierta — %s', v_new->>'fecha');
    elsif v_old->>'estado' is distinct from v_new->>'estado' and v_new->>'estado' = 'cerrada' then
      v_tipo := 'caja_cierre'; v_desc := format('Caja cerrada — Total %s', fn_fmt_pesos((v_new->>'total_cobros')::numeric));
    elsif v_old->>'estado' is distinct from v_new->>'estado' and v_old->>'estado' = 'cerrada' then
      v_tipo := 'caja_reapertura'; v_desc := 'Caja reabierta';
    else
      v_tipo := 'caja_editada'; v_desc := 'Caja editada';
    end if;

  elsif TG_TABLE_NAME = 'leads' then
    v_fecha := current_date;
    if TG_OP = 'INSERT' then
      v_tipo := 'lead_nuevo'; v_desc := format('Lead nuevo — %s', v_new->>'nombre');
    else
      v_tipo := 'lead_editado'; v_desc := format('Lead editado — %s', v_new->>'nombre');
    end if;

  elsif TG_TABLE_NAME = 'temporadas' then
    v_fecha := current_date;
    v_tipo := 'temporada_' || lower(TG_OP);
    v_desc := format('Temporada %s — %s', lower(TG_OP), coalesce(v_new->>'nombre', v_old->>'nombre'));

  else
    v_fecha := current_date;
    v_tipo := lower(TG_TABLE_NAME || '_' || TG_OP);
    v_desc := format('%s %s', TG_TABLE_NAME, lower(TG_OP));
  end if;

  if v_cliente_id is not null then
    select nombre into v_cliente_nombre from clientes where id = v_cliente_id;
  end if;

  insert into eventos (tabla, operacion, registro_id, descripcion, fecha_ref, datos, usuario, tipo_evento, actor_nombre, cliente_id, cliente_nombre)
  values (
    TG_TABLE_NAME, TG_OP, v_id, v_desc, v_fecha,
    jsonb_strip_nulls(jsonb_build_object('before', v_old, 'after', v_new)),
    auth.uid(), v_tipo, v_actor_nombre, v_cliente_id, v_cliente_nombre
  );
  return null;
end;
$function$;

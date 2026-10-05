-- Reservas con precio unificado (ver reserva_grupos, migración anterior): el
-- saldo/estado_pago de una reserva agrupada se calcula contra
-- reserva_grupos.precio_total y la suma de pagos de TODAS las reservas del
-- grupo — nunca contra el valor_total individual de cada período. Se
-- actualizan los MISMOS dos triggers que ya mantenían esto para una reserva
-- suelta, para no inventar un tercer camino de escritura de saldo/estado_pago
-- (ver CLAUDE.md "single write, multiple reactive reads"). Reservas sin
-- grupo_id se comportan exactamente igual que antes.

create or replace function public.fn_reserva_recalcula_saldo()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
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
    return new;
  end if;

  if new.grupo_id is not null then
    select precio_total into v_total from reserva_grupos where id = new.grupo_id;
    -- union con new.id: cuando esta fila se está agrupando recién ahora
    -- (UPDATE que setea grupo_id por primera vez), el storage todavía tiene
    -- su grupo_id viejo (null) al momento de este BEFORE trigger — el select
    -- por grupo_id solo no la encontraría a ella misma todavía.
    select coalesce(sum(p.monto), 0) into v_pagado
      from pagos p
      where p.estado = 'vigente' and p.reserva_id in (
        select id from reservas where grupo_id = new.grupo_id
        union select new.id
      );
    v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
    new.saldo := v_saldo;
    new.estado_pago := case
      when v_pagado <= 0 then 'pendiente'
      when v_saldo <= 0 then 'pagado'
      else 'parcial'
    end;
    return new;
  end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = new.id and estado = 'vigente';
  v_saldo := greatest(coalesce(new.valor_total, 0) - v_pagado, 0);
  new.saldo := v_saldo;
  new.estado_pago := case
    when v_pagado <= 0 then 'pendiente'
    when v_saldo <= 0 then 'pagado'
    else 'parcial'
  end;
  return new;
end;
$function$;

create or replace function public.fn_pago_actualiza_saldo()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva_id uuid;
  v_grupo_id uuid;
  v_total numeric;
  v_pagado numeric;
  v_saldo numeric;
begin
  v_reserva_id := coalesce(new.reserva_id, old.reserva_id);
  if v_reserva_id is null then
    return coalesce(new, old);
  end if;

  select grupo_id into v_grupo_id from reservas where id = v_reserva_id;

  if v_grupo_id is not null then
    select precio_total into v_total from reserva_grupos where id = v_grupo_id;
    select coalesce(sum(p.monto), 0) into v_pagado
      from pagos p join reservas r on r.id = p.reserva_id
      where r.grupo_id = v_grupo_id and p.estado = 'vigente';
    v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
    update reservas set
      saldo = v_saldo,
      estado_pago = case
        when v_pagado <= 0 then 'pendiente'
        when v_saldo <= 0 then 'pagado'
        else 'parcial'
      end
    where grupo_id = v_grupo_id;
    return coalesce(new, old);
  end if;

  select valor_total into v_total from reservas where id = v_reserva_id;
  if not found then
    return coalesce(new, old);
  end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = v_reserva_id and estado = 'vigente';
  v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);

  update reservas set
    saldo = v_saldo,
    estado_pago = case
      when v_pagado <= 0 then 'pendiente'
      when v_saldo <= 0 then 'pagado'
      else 'parcial'
    end
  where id = v_reserva_id;

  return coalesce(new, old);
end;
$function$;

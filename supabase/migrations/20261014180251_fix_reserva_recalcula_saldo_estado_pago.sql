create or replace function fn_reserva_recalcula_saldo()
returns trigger
language plpgsql
set search_path = public
as $$
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
      new.estado_pago := 'pendiente';
    elsif v_sin_monto > 0 then
      new.saldo := null;
      new.estado_pago := 'parcial';
    else
      v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
      new.saldo := v_saldo;
      new.estado_pago := case when v_saldo <= 0 then 'pagado' else 'parcial' end;
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
    new.estado_pago := 'pendiente';
  elsif v_sin_monto > 0 then
    new.saldo := null;
    new.estado_pago := 'parcial';
  else
    v_saldo := greatest(coalesce(new.valor_total, 0) - v_pagado, 0);
    new.saldo := v_saldo;
    new.estado_pago := case when v_saldo <= 0 then 'pagado' else 'parcial' end;
    if new.origen = 'web' and v_saldo <= 0 then new.preconfirmada := false; end if;
  end if;

  return new;
end;
$$;

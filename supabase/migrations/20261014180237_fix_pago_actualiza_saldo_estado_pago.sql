create or replace function fn_pago_actualiza_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva_id uuid;
  v_grupo_id uuid;
  v_total numeric;
  v_pagos_reales integer;
  v_sin_monto integer;
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
    select
      count(*) filter (where fn_pago_es_real(p.id, p.monto)),
      count(*) filter (where fn_pago_es_real(p.id, p.monto) and p.monto is null),
      coalesce(sum(p.monto) filter (where fn_pago_es_real(p.id, p.monto)), 0)
      into v_pagos_reales, v_sin_monto, v_pagado
      from pagos p join reservas r on r.id = p.reserva_id
      where r.grupo_id = v_grupo_id and p.estado = 'vigente';

    if v_pagos_reales = 0 then
      update reservas set saldo = v_total, estado_pago = 'pendiente' where grupo_id = v_grupo_id;
    elsif v_sin_monto > 0 then
      update reservas set saldo = null, estado_pago = 'parcial' where grupo_id = v_grupo_id;
    else
      v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
      update reservas set
        saldo = v_saldo,
        estado_pago = case when v_saldo <= 0 then 'pagado' else 'parcial' end,
        preconfirmada = case when origen = 'web' and v_saldo <= 0 then false else preconfirmada end
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

  if v_pagos_reales = 0 then
    update reservas set saldo = coalesce(v_total, 0), estado_pago = 'pendiente' where id = v_reserva_id;
  elsif v_sin_monto > 0 then
    update reservas set saldo = null, estado_pago = 'parcial' where id = v_reserva_id;
  else
    v_saldo := greatest(coalesce(v_total, 0) - v_pagado, 0);
    update reservas set
      saldo = v_saldo,
      estado_pago = case when v_saldo <= 0 then 'pagado' else 'parcial' end,
      preconfirmada = case when origen = 'web' and v_saldo <= 0 then false else preconfirmada end
    where id = v_reserva_id;
  end if;

  return coalesce(new, old);
end;
$$;

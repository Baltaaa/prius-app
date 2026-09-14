-- Fase 2 (parte 1): motor de pagos real sobre la tabla `pagos` ya existente.
-- Reemplaza la carga manual de reservas.saldo/estado_pago que quedó
-- provisional en la sesión anterior. Comprobante sigue siendo solo un
-- registro interno (numero/texto libre) — no hay integración ARCA/AFIP.

alter table public.pagos
  add column if not exists nro_cuota integer;

alter table public.pagos
  drop constraint if exists pagos_medio_check;

alter table public.pagos
  add constraint pagos_medio_check
  check (medio = any (array['efectivo','tarjeta_credito','tarjeta_debito','transferencia']));

-- Recalcula reservas.saldo/estado_pago cuando cambian los pagos de esa reserva.
create or replace function public.fn_pago_actualiza_saldo()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_reserva_id uuid;
  v_total numeric;
  v_pagado numeric;
  v_saldo numeric;
begin
  v_reserva_id := coalesce(new.reserva_id, old.reserva_id);
  if v_reserva_id is null then
    return coalesce(new, old);
  end if;

  select valor_total into v_total from reservas where id = v_reserva_id;
  if not found then
    return coalesce(new, old);
  end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = v_reserva_id;
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
$$;

drop trigger if exists trg_pago_actualiza_saldo on public.pagos;
create trigger trg_pago_actualiza_saldo
  after insert or update or delete on public.pagos
  for each row execute function public.fn_pago_actualiza_saldo();

-- Mantiene saldo/estado_pago consistentes si se edita valor_total a mano
-- (ej. se corrige el monto contratado de una reserva ya con pagos).
create or replace function public.fn_reserva_recalcula_saldo()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pagado numeric;
  v_saldo numeric;
begin
  select coalesce(sum(monto), 0) into v_pagado from pagos where reserva_id = new.id;
  v_saldo := greatest(coalesce(new.valor_total, 0) - v_pagado, 0);
  new.saldo := v_saldo;
  new.estado_pago := case
    when v_pagado <= 0 then 'pendiente'
    when v_saldo <= 0 then 'pagado'
    else 'parcial'
  end;
  return new;
end;
$$;

drop trigger if exists trg_reserva_recalcula_saldo on public.reservas;
create trigger trg_reserva_recalcula_saldo
  before insert or update of valor_total on public.reservas
  for each row execute function public.fn_reserva_recalcula_saldo();

alter publication supabase_realtime add table public.pagos;

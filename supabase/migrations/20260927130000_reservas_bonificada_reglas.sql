-- Formaliza "unidad bonificada" como propiedad de la RESERVA (no de la
-- unidad): reservas.bonificada ya existía en la base (columna agregada fuera
-- de las migraciones versionadas, parte de la migración histórica del
-- Excel) pero sin ninguna regla que la sostenga. Se documenta acá y se hace
-- cumplir el modelo: costo_total=0 y estado_pago='pagado' siempre que
-- bonificada=true, sin importar qué mande el cliente en el resto del
-- insert/update.

comment on column public.reservas.bonificada is
  'Unidad bonificada (propiedad de la reserva, no de la unidad): sin cargo, no admite pagos. Fuerza valor_total=0 y estado_pago=pagado — ver fn_reserva_recalcula_saldo. El insert de pagos sobre una reserva bonificada lo bloquea trg_pago_bloquea_bonificada.';

-- Extiende fn_reserva_recalcula_saldo (ya existía para recalcular
-- saldo/estado_pago a partir de valor_total y los pagos reales) en vez de
-- crear un trigger paralelo — un solo lugar decide saldo/estado_pago.
create or replace function public.fn_reserva_recalcula_saldo()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pagado numeric;
  v_saldo numeric;
begin
  if new.bonificada then
    if exists (select 1 from pagos where reserva_id = new.id) then
      raise exception 'No se puede marcar como bonificada: la reserva ya tiene pagos registrados.';
    end if;
    new.valor_total := 0;
    new.saldo := 0;
    new.estado_pago := 'pagado';
    return new;
  end if;

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

-- Se agrega "bonificada" a la lista de columnas que disparan el trigger —
-- antes solo reaccionaba a cambios de valor_total — para que tildar/destildar
-- el toggle sin tocar el precio también recalcule.
drop trigger if exists trg_reserva_recalcula_saldo on public.reservas;
create trigger trg_reserva_recalcula_saldo
  before insert or update of valor_total, bonificada on public.reservas
  for each row execute function public.fn_reserva_recalcula_saldo();

-- Bloqueo a nivel base: ninguna reserva bonificada puede recibir un pago, ni
-- por insert directo ni reasignando pagos.reserva_id en un update. La UI ya
-- oculta el ícono de "Registrar pago", pero esto es lo que realmente lo
-- impide si algo lo intenta igual.
create or replace function public.fn_pago_bloquea_bonificada()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_bonificada boolean;
begin
  select bonificada into v_bonificada from reservas where id = new.reserva_id;
  if v_bonificada then
    raise exception 'No se pueden registrar pagos sobre una reserva bonificada (unidad sin cargo).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pago_bloquea_bonificada on public.pagos;
create trigger trg_pago_bloquea_bonificada
  before insert or update of reserva_id on public.pagos
  for each row execute function public.fn_pago_bloquea_bonificada();

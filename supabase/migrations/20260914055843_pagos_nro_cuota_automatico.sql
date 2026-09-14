-- nro_cuota (instancia de pago sobre el saldo de la reserva) dejó de cargarse
-- a mano: se detectó que permitía repetir el mismo número (ej. dos pagos con
-- nro_cuota=1 en la misma reserva). Ahora lo asigna siempre el trigger,
-- como "próximo número secuencial" para esa reserva — 1, 2, 3... sin huecos
-- ni repetidos, sin importar qué mande el cliente en el insert.

-- Backfill: recalcula el histórico existente en orden cronológico real.
update public.pagos p
set nro_cuota = sub.rn
from (
  select id, row_number() over (partition by reserva_id order by created_at) as rn
  from public.pagos
) sub
where p.id = sub.id;

create or replace function public.fn_pago_asigna_nro_cuota()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from pagos where reserva_id = new.reserva_id;
  new.nro_cuota := v_count + 1;
  return new;
end;
$$;

drop trigger if exists trg_pago_asigna_nro_cuota on public.pagos;
create trigger trg_pago_asigna_nro_cuota
  before insert on public.pagos
  for each row execute function public.fn_pago_asigna_nro_cuota();

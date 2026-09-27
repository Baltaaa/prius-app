-- Cruce automático pago -> caja_diaria (Task 1) + apertura/cierre encadenado
-- por día (Task 2/3). No toca fn_pago_actualiza_saldo/fn_reserva_recalcula_saldo
-- (motor de saldo de reservas) — esto es un trigger nuevo y separado sobre el
-- mismo INSERT en `pagos`.

alter table public.caja_diaria
  add column if not exists saldo_apertura numeric default 0;

-- Ingresos itemizados (antes solo existían egresos en gastos_caja; los
-- ingresos eran 3 campos agregados en caja_diaria sin trazabilidad ni carga
-- real desde la UI). Un ingreso = un pago cruzado a caja, o en el futuro un
-- ingreso manual sin pago asociado (pago_id nullable).
create table public.ingresos_caja (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid references public.caja_diaria(id) on delete cascade,
  pago_id uuid references public.pagos(id) on delete cascade,
  reserva_id uuid references public.reservas(id),
  cliente_id uuid references public.clientes(id),
  monto numeric not null,
  medio text,
  -- Distingue billete físico (efectivo) de todo lo demás (tarjeta/transferencia)
  -- para que el arqueo de billetes reales nunca se mezcle con medios no físicos.
  es_efectivo boolean not null default false,
  concepto text,
  created_at timestamptz default now()
);

alter table public.ingresos_caja enable row level security;
create policy auth_all_ingresos_caja on public.ingresos_caja for all to authenticated using (true);

create trigger trg_zzz_log_evento
  after insert or update or delete on public.ingresos_caja
  for each row execute function public.fn_log_evento();

-- Único cálculo de saldo diario (Task 3): apertura = cierre del día anterior
-- (solo se fija en el INSERT, ignora lo que mande el cliente); total_neto
-- siempre se recalcula acá, así ninguna pantalla necesita duplicar la cuenta.
create or replace function public.fn_caja_calcula_totales()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if TG_OP = 'INSERT' then
    select coalesce(total_neto, 0) into new.saldo_apertura
    from caja_diaria
    where fecha < new.fecha
    order by fecha desc
    limit 1;
    new.saldo_apertura := coalesce(new.saldo_apertura, 0);
  end if;

  new.total_neto := coalesce(new.saldo_apertura, 0) + coalesce(new.total_cobros, 0) - coalesce(new.total_gastos, 0);
  return new;
end;
$$;

drop trigger if exists trg_caja_calcula_totales on public.caja_diaria;
create trigger trg_caja_calcula_totales
  before insert or update on public.caja_diaria
  for each row execute function public.fn_caja_calcula_totales();

-- Al insertar un pago: asegura la caja del día (la crea si no existe — el
-- cruce es automático, no depende de que el admin haya "abierto" la caja a
-- mano) y registra el ingreso itemizado con su referencia de origen.
create or replace function public.fn_pago_crea_ingreso_caja()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_caja_id uuid;
  v_cliente_id uuid;
  v_cliente_nombre text;
  v_fecha date;
begin
  v_fecha := coalesce(new.fecha, current_date);

  insert into caja_diaria (fecha)
  values (v_fecha)
  on conflict (fecha) do nothing;

  select id into v_caja_id from caja_diaria where fecha = v_fecha;

  select r.cliente_id, c.nombre into v_cliente_id, v_cliente_nombre
  from reservas r left join clientes c on c.id = r.cliente_id
  where r.id = new.reserva_id;

  insert into ingresos_caja (caja_id, pago_id, reserva_id, cliente_id, monto, medio, es_efectivo, concepto)
  values (
    v_caja_id, new.id, new.reserva_id, v_cliente_id, new.monto, new.medio,
    new.medio = 'efectivo',
    format('Pago %s — %s', coalesce(v_cliente_nombre, 'S/N'), new.medio)
  );

  return new;
end;
$$;

drop trigger if exists trg_pago_crea_ingreso_caja on public.pagos;
create trigger trg_pago_crea_ingreso_caja
  after insert on public.pagos
  for each row execute function public.fn_pago_crea_ingreso_caja();

-- Recalcula total_cobros de caja_diaria = campos manuales (efectivo/medio_pago_1/
-- medio_pago_2, legacy, hoy siempre 0 porque la UI no los carga) + suma de
-- ingresos_caja de esa caja. El UPDATE dispara trg_caja_calcula_totales, que
-- recalcula total_neto — un solo lugar para esa cuenta.
create or replace function public.fn_ingreso_caja_recalcula()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_caja_id uuid;
  v_suma_ingresos numeric;
  v_manual numeric;
begin
  v_caja_id := coalesce(new.caja_id, old.caja_id);
  if v_caja_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(monto), 0) into v_suma_ingresos from ingresos_caja where caja_id = v_caja_id;
  select coalesce(efectivo, 0) + coalesce(medio_pago_1, 0) + coalesce(medio_pago_2, 0)
    into v_manual
  from caja_diaria where id = v_caja_id;

  update caja_diaria set total_cobros = v_manual + v_suma_ingresos where id = v_caja_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ingreso_caja_recalcula on public.ingresos_caja;
create trigger trg_ingreso_caja_recalcula
  after insert or delete on public.ingresos_caja
  for each row execute function public.fn_ingreso_caja_recalcula();

alter publication supabase_realtime add table public.ingresos_caja;

-- Backfill: apertura encadenada para las filas de caja_diaria que ya existían
-- antes de esta migración (el trigger solo asigna apertura en el INSERT).
with ordenado as (
  select id,
         coalesce(sum(total_cobros - total_gastos) over (order by fecha rows between unbounded preceding and 1 preceding), 0) as apertura_calc
  from caja_diaria
)
update caja_diaria c
set saldo_apertura = o.apertura_calc
from ordenado o
where c.id = o.id;

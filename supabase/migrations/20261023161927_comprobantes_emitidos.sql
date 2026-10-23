-- Testing 23/10/2026, item 15: ID correlativo único por comprobante interno
-- emitido desde /app/comprobantes (el "documento interno" de
-- ComprobanteDocumento.jsx — distinto de la tabla `comprobantes`, que son
-- las facturas/recibos FB/RB cargados a mano por fuera del CRM). Antes el
-- "número" era un slice del uuid de la reserva, calculado en el front,
-- nunca persistido: cada reimpresión podía mostrar datos distintos si algo
-- cambiaba entre medio. Aditivo: tabla nueva, no toca nada existente.

create sequence if not exists comprobantes_emitidos_numero_seq start 1;

create table if not exists comprobantes_emitidos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique default nextval('comprobantes_emitidos_numero_seq'),
  reserva_id uuid not null references reservas(id),
  pago_id uuid references pagos(id),
  tipo text not null check (tipo in ('estado_cuenta', 'recibo')),
  snapshot jsonb not null,
  emitido_por uuid references auth.users(id),
  emitido_at timestamptz not null default now()
);

alter sequence comprobantes_emitidos_numero_seq owned by comprobantes_emitidos.numero;

create index if not exists idx_comprobantes_emitidos_reserva on comprobantes_emitidos(reserva_id);

alter table comprobantes_emitidos enable row level security;

-- Sin policies de INSERT/SELECT directo para authenticated: todo pasa por
-- fn_emitir_comprobante (SECURITY DEFINER) — mismo patrón que pagos/
-- comprobantes/caja_diaria. anon sin ningún acceso.
revoke all on comprobantes_emitidos from anon, authenticated;

create or replace function public.fn_emitir_comprobante(
  p_reserva_id uuid,
  p_pago_id uuid,
  p_tipo text,
  p_snapshot jsonb
)
returns comprobantes_emitidos
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row comprobantes_emitidos;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if p_tipo not in ('estado_cuenta', 'recibo') then
    raise exception 'Tipo de comprobante inválido.';
  end if;

  insert into comprobantes_emitidos (reserva_id, pago_id, tipo, snapshot, emitido_por)
  values (p_reserva_id, p_pago_id, p_tipo, p_snapshot, auth.uid())
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.fn_emitir_comprobante(uuid, uuid, text, jsonb) to authenticated;

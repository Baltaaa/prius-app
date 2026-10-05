-- Bug crítico (oct 2026): los comprobantes importados del Excel quedaron como
-- texto libre en pagos.comprobante, nunca promovidos a filas estructuradas —
-- por eso la UI siempre mostraba "Sin comprobante" en pagos históricos. Un
-- pago puede tener VARIOS comprobantes (ver script de vinculación), así que
-- la relación correcta es comprobantes.pago_id -> pagos.id (muchos
-- comprobantes, un pago), no al revés. pagos.comprobante_id se mantiene para
-- el flujo en vivo de "cargar un comprobante" (RegistrarPago/DetallePago,
-- completar_comprobante) — completar_comprobante ahora también completa
-- pago_id en el comprobante nuevo, así ambos caminos quedan consistentes.
alter table comprobantes add column pago_id uuid references pagos(id);
create index idx_comprobantes_pago_id on comprobantes(pago_id);

-- numero como texto tal cual (el Excel no tiene relleno de ceros ni formato
-- fijo) — el CHECK numérico de rango ya no aplica.
alter table comprobantes drop constraint comprobantes_numero_check;
alter table comprobantes alter column numero type text using numero::text;

-- El Excel no tiene fecha ni monto por comprobante individual — no se inventan.
alter table comprobantes alter column fecha drop not null;
alter table comprobantes alter column fecha drop default;
alter table comprobantes alter column monto_total drop not null;
alter table comprobantes alter column monto_total drop default;

-- Default explícito: el punto de venta real es casi siempre 1 (ver ítem 3,
-- formato único de comprobante).
alter table comprobantes alter column punto_venta set default 1;

create or replace function public.completar_comprobante(p_pago_id uuid, p_comprobante jsonb)
 returns pagos
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pago pagos;
  v_comprobante_id uuid;
  v_cliente_condicion text;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  select * into v_pago from pagos where id = p_pago_id;
  if not found then raise exception 'El pago no existe.'; end if;

  if p_comprobante ? 'comprobante_id' then
    v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
    update comprobantes set pago_id = p_pago_id where id = v_comprobante_id and pago_id is null;
  else
    select condicion_iva into v_cliente_condicion from clientes where id = v_pago.cliente_id;
    insert into comprobantes (tipo, punto_venta, numero, fecha, cliente_id, razon_social, cuit, condicion_iva, monto_total, pago_id)
    select p_comprobante->>'tipo', coalesce((p_comprobante->>'punto_venta')::integer, 1), p_comprobante->>'numero',
      coalesce((p_comprobante->>'fecha')::date, current_date), v_pago.cliente_id, c.razon_social, c.cuit,
      coalesce(v_cliente_condicion, 'consumidor_final'), 0, p_pago_id
    from clientes c where c.id = v_pago.cliente_id
    returning id into v_comprobante_id;
  end if;

  update pagos set comprobante_id = v_comprobante_id where id = p_pago_id returning * into v_pago;
  update comprobantes set monto_total = (
    select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
  ) where id = v_comprobante_id;

  insert into caja_eventos (caja_id, tipo, detalle, usuario)
  select v_pago.caja_id, 'anulacion_pago', jsonb_build_object('accion','completar_comprobante','pago_id',p_pago_id), auth.uid()
  where v_pago.caja_id is not null;

  return v_pago;
end;
$function$;

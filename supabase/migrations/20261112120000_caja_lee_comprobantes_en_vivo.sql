-- Caja: las correcciones de comprobantes se ven también en una caja cerrada
-- (nov 2026, bug reportado por el administrador).
--
-- Caso real: cargó un RB (recibo) a un cliente, vio el error en el resumen de
-- la caja ya cerrada, lo corrigió a FB (factura) desde la ficha del cliente, y
-- la caja cerrada seguía mostrando RB.
--
-- Causa: `resumen_caja()` SIEMPRE leyó de las tablas fuente (pagos,
-- comprobantes, gastos_caja) — no hay nada que arreglar ahí. Lo que estaba mal
-- era QUIÉN leía: el front, para una caja cerrada, mostraba
-- `caja_diaria.resumen_snapshot`, la copia congelada al cerrar. Eso se corrige
-- del lado del front (src/pages/crm/Caja.jsx: siempre resumen_caja(caja_id),
-- esté abierta o cerrada). El snapshot se sigue escribiendo al cerrar, pero
-- solo como registro de auditoría: no se muestra, no se imprime, no se exporta.
--
-- Acá queda lo que sí es de base:
--
-- 1) `fn_editar_pago_completo` imputaba el pago editado a la caja que estuviera
--    ABIERTA, no a la del día en que el cliente pagó — al revés de la regla de
--    toda la app (`fn_registrar_pago_interno` usa `fn_resolver_caja_id(fecha)`).
--    Por eso además fallaba con "La caja está cerrada: abrí la caja…" al
--    corregir un pago de un día ya cerrado. Pasa a usar la misma regla: el pago
--    va a la caja de SU fecha (se crea si ese día todavía no tenía caja), y los
--    pagos anteriores a `fn_caja_inicio()` (01/10/2026) siguen sin caja.
--    El trigger `trg_pago_recalcula_caja` ya recalcula las dos cajas cuando el
--    caja_id cambia, así que el total y el esperado del arqueo de ambas quedan
--    al día. El "contado" del arqueo no se toca nunca: es lo que contó el
--    cajero; si el esperado cambia, se ve como diferencia de arqueo.
--
-- 2) El comentario de la columna `resumen_snapshot`, para que quede escrito que
--    ya no es fuente de lectura.

create or replace function public.fn_editar_pago_completo(
  p_pago_id uuid,
  p_monto numeric,
  p_medio text,
  p_tipo_pago text,
  p_fecha date,
  p_comprobante jsonb default null::jsonb
)
returns pagos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pago pagos;
  v_caja_id uuid;
  v_comprobante_id uuid;
begin
  if not es_admin() then
    raise exception 'No tenés permiso para editar este pago.' using errcode = '42501';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá un monto válido.';
  end if;
  if p_fecha is null then
    raise exception 'Elegí una fecha para el pago.';
  end if;

  select * into v_pago from pagos where id = p_pago_id;
  if not found then
    raise exception 'El pago no existe.';
  end if;
  if v_pago.estado = 'anulado' then
    raise exception 'Este pago está anulado — no se puede editar.';
  end if;

  -- Misma regla que registrar un pago nuevo: la caja del día en que el cliente
  -- pagó (null si es anterior al inicio de la caja diaria).
  v_caja_id := fn_resolver_caja_id(p_fecha);

  update pagos
  set monto = round(p_monto),
      monto_pendiente_verificacion = false,
      medio = p_medio,
      tipo_pago = p_tipo_pago,
      fecha = p_fecha,
      caja_id = v_caja_id
  where id = p_pago_id
  returning * into v_pago;

  if p_comprobante is not null then
    if p_comprobante ? 'comprobante_id' then
      v_comprobante_id := (p_comprobante->>'comprobante_id')::uuid;
      update comprobantes set pago_id = p_pago_id where id = v_comprobante_id and (pago_id is null or pago_id = p_pago_id);
    else
      v_comprobante_id := fn_vincular_comprobante(
        p_comprobante->>'tipo',
        (p_comprobante->>'punto_venta')::integer,
        p_comprobante->>'numero',
        coalesce((p_comprobante->>'fecha')::date, p_fecha),
        v_pago.cliente_id,
        p_pago_id
      );
    end if;
    update pagos set comprobante_id = v_comprobante_id where id = p_pago_id returning * into v_pago;
    update comprobantes set monto_total = (
      select coalesce(sum(monto), 0) from pagos where comprobante_id = v_comprobante_id and estado = 'vigente'
    ) where id = v_comprobante_id;
  end if;

  return v_pago;
exception
  when unique_violation then raise exception 'Ya existe un comprobante con ese tipo, punto de venta y número.';
  when check_violation then raise exception 'Los datos del pago o el comprobante no son válidos.';
end;
$function$;

comment on column public.caja_diaria.resumen_snapshot is
  'Foto de resumen_caja() al cerrar la caja — SOLO auditoría (nov 2026). No es fuente de lectura: pantalla, impresión A4, CSV e Historial piden resumen_caja(caja_id) en vivo, para que una corrección posterior de un comprobante (tipo RB/FB, número, monto, medio, fecha) se vea también en una caja ya cerrada.';

// Total del día de una caja — ÚNICA fuente (nov 2026, "Cierre Z").
//
// La Z es el Informe Diario de Cierre (Cód. 080) del controlador fiscal
// PosNet: sus tiques son ventas fiscales APARTE de las facturas y recibos que
// se cargan en el CRM. Por eso se SUMA, nunca se compara ni se resta contra
// lo registrado (el viejo "diferencia vs registrado" era un error conceptual
// y se borró de la UI, de la impresión, del CSV y de resumen_caja()).
//
//   Total del día = facturas y recibos del CRM + Total Z
//
// Es un valor DERIVADO: no se guarda ninguna columna nueva, así las cajas
// ya cerradas con Z cargada muestran el total con la regla nueva al verlas o
// reimprimirlas, sin reescribir un solo dato.
//
// La Z no toca el arqueo (esperado/contado/diferencia por medio de pago) ni
// el desglose por medio: son el conteo del dinero que pasó por el CRM.

/** Suma base. Todo total del día de la app sale de acá. */
export function componerTotalDia(facturasYRecibos, totalZ) {
  const fr = Number(facturasYRecibos) || 0
  const z = Number(totalZ) || 0
  return { facturasYRecibos: fr, z, total: fr + z }
}

/**
 * `true` si la caja se cerró con Z cargada. Alcanza con el N.° O con el total:
 * hay cajas reales cerradas con el total y la cantidad de comprobantes pero sin
 * el N.° tipeado (ej. 08/11/2026), y esa Z igual tiene que sumar. Sin ninguno
 * de los dos, la caja se cerró sin Z ("Tengo cierre Z" desmarcado).
 */
export function tieneZ(fuente) {
  if (!fuente) return false
  // `resumen_caja()` la devuelve en `z.numero`/`z.total`; la fila de
  // caja_diaria, en `z_numero`/`z_total`.
  const numero = fuente.z?.numero ?? fuente.z_numero
  if (numero != null && String(numero).trim() !== '') return true
  const total = Number(fuente.z?.total ?? fuente.z_total)
  return Number.isFinite(total) && total !== 0
}

/** Monto de la Z, de un resumen_caja() o de una fila de caja_diaria. 0 sin Z. */
export function montoZ(fuente) {
  if (!tieneZ(fuente)) return 0
  return Number(fuente.z?.total ?? fuente.z_total) || 0
}

/**
 * Totales del día de un `resumen_caja()` (pantalla, paso 3 del cierre,
 * impresión A4 y CSV). `ingresos` y `neto` ya incluyen la Z; `movimientos`
 * sigue contando solo los movimientos del CRM.
 */
export function totalDiaResumen(resumen) {
  const base = componerTotalDia(resumen?.totales?.ingresos, montoZ(resumen))
  const egresos = Number(resumen?.totales?.egresos) || 0
  return { ...base, egresos, ingresos: base.total, neto: base.total - egresos, conZ: tieneZ(resumen) }
}

/**
 * Total del día de una fila de `caja_diaria` (Historial de cajas y widget
 * "Caja diaria" del sidebar), que no tiene el resumen entero a mano.
 * `campo`: `total_neto` (historial) o `total_cobros` (sidebar).
 */
export function totalDiaCaja(caja, campo = 'total_neto') {
  return componerTotalDia(caja?.[campo], montoZ(caja)).total
}

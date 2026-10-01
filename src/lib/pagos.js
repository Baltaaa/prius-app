// Helpers compartidos del circuito de dinero (Caja Fase 3) — un solo lugar
// para medios de pago, tipos de pago, comprobantes y el armado de textos
// tipo "Tarjeta de Crédito — 3 cuotas", usado por RegistrarPago, DetallePago,
// Clientes, Reservas y Caja.

export const MEDIO_PAGO_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  tarjeta_debito: 'Tarjeta de Débito',
  tarjeta_credito: 'Tarjeta de Crédito',
}

// `cuotas_tarjeta` es la cantidad de cuotas en la que la tarjeta le cobra el
// pago al cliente — distinto de `nro_cuota` (qué instancia de pago es esta
// sobre el saldo total de la reserva). Solo tiene sentido con tarjeta_credito.
export function formatMedioPago(pago) {
  const label = MEDIO_PAGO_LABEL[pago?.medio] || pago?.medio || ''
  if (pago?.medio === 'tarjeta_credito' && pago?.cuotas_tarjeta) {
    return `${label} — ${pago.cuotas_tarjeta} cuota${pago.cuotas_tarjeta > 1 ? 's' : ''}`
  }
  return label
}

export const TIPO_PAGO_LABEL = {
  sena: 'Seña',
  parcial: 'Pago parcial',
  saldo: 'Saldo',
  total: 'Pago total',
  servicio: 'Servicio',
  otro: 'Otro',
}

// Sugiere el tipo_pago según cuánto cubre el monto sobre el saldo actual —
// el usuario lo puede cambiar a mano, esto es solo el default inicial.
export function sugerirTipoPago(monto, saldo, pagado) {
  const m = Number(monto) || 0
  const s = Number(saldo) || 0
  if (m <= 0) return 'parcial'
  if (m >= s && s > 0) return pagado > 0 ? 'saldo' : 'total'
  return pagado > 0 ? 'parcial' : 'sena'
}

export const COMPROBANTE_TIPO_LABEL = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  factura_c: 'Factura C',
  recibo_a: 'Recibo A',
  recibo_b: 'Recibo B',
  recibo_c: 'Recibo C',
  recibo_x: 'Recibo X',
}

// Chips cortos para el selector de comprobante (FA/FB/FC/RA/RB/RC/RX).
export const COMPROBANTE_TIPO_SIGLA = {
  factura_a: 'FA', factura_b: 'FB', factura_c: 'FC',
  recibo_a: 'RA', recibo_b: 'RB', recibo_c: 'RC', recibo_x: 'RX',
}

// Default de tipo de comprobante según condición IVA del cliente — el
// administrador lo puede cambiar a mano, esto solo evita el clic extra en el
// caso más común.
export function comprobanteTipoDefault(condicionIva) {
  return condicionIva === 'responsable_inscripto' ? 'factura_a' : 'factura_b'
}

// Etiqueta corta "FB 0001-00000727", espejo de fn_comprobante_etiqueta en la
// base — usada para previsualizar antes de guardar (la base es la fuente de
// verdad una vez creado el comprobante).
export function comprobanteEtiqueta(comprobante) {
  if (!comprobante) return null
  const sigla = COMPROBANTE_TIPO_SIGLA[comprobante.tipo] || '??'
  const pv = String(comprobante.punto_venta ?? '').padStart(4, '0')
  const nro = String(comprobante.numero ?? '').padStart(8, '0')
  return `${sigla} ${pv}-${nro}`
}

export const CONDICION_IVA_LABEL = {
  consumidor_final: 'Consumidor Final',
  monotributo: 'Monotributo',
  responsable_inscripto: 'Responsable Inscripto',
  exento: 'Exento',
}

// Códigos de error que devuelven las RPC de dinero (raise exception ...
// using errcode) — un solo lugar para no repetir los strings mágicos.
export const ERROR_CAJA_CERRADA = 'P0003'
export const ERROR_EXCEDE_SALDO = 'P0002'

// Fecha en que arrancó a funcionar la caja digital — espejo en el front de
// fn_caja_inicio() en la base (única fuente de verdad real, ver migración
// pagos_historicos_fecha_y_caja). Un pago con fecha anterior a esto es
// histórico: no exige caja abierta y nunca entra a ningún resumen de caja.
export const CAJA_INICIO = '2026-10-01'

export function esPagoHistorico(fechaIso) {
  return !!fechaIso && fechaIso < CAJA_INICIO
}

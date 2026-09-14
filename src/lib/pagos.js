// Helpers compartidos del motor de pagos (Fase 2) — un solo lugar para el
// mapeo medio→label y el armado de "Tarjeta de Crédito — 3 cuotas", usado
// por PagoModal, Clientes (historial inline) y Comprobantes.

export const MEDIO_PAGO_LABEL = {
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta de Crédito',
  tarjeta_debito: 'Tarjeta de Débito',
  transferencia: 'Transferencia',
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

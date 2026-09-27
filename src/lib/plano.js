// Sector/pasillo de una carpa según su número — puramente visual, calculado
// acá a partir del layout fijo del plano (ver CLAUDE.md "Layout del plano de
// carpas"), nunca guardado en la base. Las sombrillas tienen layout fijo
// propio, sin sub-sectores.
export function sectorDeUnidad(tipo, numero) {
  if (tipo === 'sombrilla') return 'Sector Sombrillas'
  if (tipo !== 'carpa') return null
  const n = Number(numero)
  if (n >= 1 && n <= 25) return 'Hilera 1–25'
  if (n >= 26 && n <= 50) return 'Bloque 26–50'
  if (n >= 51 && n <= 75) return 'Bloque 51–75'
  if (n >= 76 && n <= 98) return 'Bloque 76–98'
  if (n >= 99 && n <= 121) return 'Bloque 99–121'
  if (n >= 122 && n <= 144) return 'Hilera 122–144'
  return null
}

// Badge de estado de una unidad para el modal de preview del Plano: 4
// estados sin ambigüedad, derivados de la reserva vigente (o su ausencia) —
// nunca editable acá (ver CLAUDE.md "Modal de unidad en el Plano").
export function estadoUnidadInfo(reserva) {
  if (!reserva) return { key: 'libre', label: 'Libre' }
  if (reserva.estado_pago === 'pendiente_confirmacion') return { key: 'sin_confirmar', label: 'Sin confirmar' }
  if (reserva.estado_pago === 'pagado') return { key: 'ocupada', label: 'Ocupada' }
  return { key: 'pendiente_pago', label: 'Pendiente de pago' }
}

/**
 * Colores por tipo_alquiler, ÚNICA fuente de verdad (Tarea 6, oct 2026) —
 * antes estaban hardcodeados por separado en Cell.jsx (Plano) y en
 * Ocupacion.jsx (COLOR_BARRA), duplicados a mano y con riesgo de
 * desincronizarse. Temporada dorado, período slate oscuro, día gris claro
 * — mismo esquema en las dos pantallas para que un usuario que ya conoce
 * el Plano reconozca los mismos colores en Ocupación.
 */
export const COLOR_TIPO_ALQUILER = {
  temporada: { bg: 'bg-[#FDE047]', border: 'border-[#FDE047]', text: 'text-black', swatch: '#FDE047' },
  periodo: { bg: 'bg-slate-600', border: 'border-slate-500', text: 'text-white', swatch: '#475569' },
  dia: { bg: 'bg-gray-300', border: 'border-gray-300', text: 'text-black', swatch: '#d1d5db' },
} as const

export const COLOR_CANCELADA = { bg: 'bg-red-500/30', border: 'border-red-500/50', text: 'text-red-100', swatch: '#ef4444' }

export type TipoAlquiler = keyof typeof COLOR_TIPO_ALQUILER

/** Clases de fondo+borde+texto para una barra/celda, según tipo_alquiler y estado. */
export function colorReserva(tipoAlquiler: string | null | undefined, estado?: string | null): string {
  if (estado === 'cancelada') return `${COLOR_CANCELADA.bg} ${COLOR_CANCELADA.border} ${COLOR_CANCELADA.text}`
  const c = COLOR_TIPO_ALQUILER[tipoAlquiler as TipoAlquiler]
  if (!c) return 'bg-white/5 border-white/10 text-white/40'
  return `${c.bg} ${c.border} ${c.text}`
}

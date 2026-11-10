/**
 * Colores por tipo_alquiler, ÚNICA fuente de verdad (Tarea 6, oct 2026) —
 * antes estaban hardcodeados por separado en Cell.jsx (Plano) y en
 * Ocupacion.jsx (COLOR_BARRA), duplicados a mano y con riesgo de
 * desincronizarse. Temporada dorado, período slate oscuro, día gris claro
 * — mismo esquema en las dos pantallas para que un usuario que ya conoce
 * el Plano reconozca los mismos colores en Ocupación.
 */
// Modo oscuro del Plano (nov 2026): en oscuro la temporada pasa al amarillo de
// marca #F2CA50 (`brand`) con la T en negro, y período/día suben un escalón de
// luminosidad para despegarse del lienzo oscuro. En claro NADA cambia: las
// clases `dark:` solo se activan con `[data-theme="dark"]` en la raíz
// (tailwind.config.js), y al imprimir la hoja siempre sale clara.
export const COLOR_TIPO_ALQUILER = {
  temporada: { bg: 'bg-[#FDE047] dark:bg-brand', border: 'border-[#FDE047] dark:border-brand', text: 'text-black', swatch: '#FDE047' },
  periodo: { bg: 'bg-slate-600 dark:bg-slate-400', border: 'border-slate-500 dark:border-slate-400', text: 'text-white dark:text-black', swatch: '#475569' },
  dia: { bg: 'bg-gray-300', border: 'border-gray-300', text: 'text-black', swatch: '#d1d5db' },
} as const

export const COLOR_CANCELADA = { bg: 'bg-red-500/30', border: 'border-red-500/50', text: 'text-red-100', swatch: '#ef4444' }

/**
 * Colores de estado de pago de una reserva, ÚNICA fuente: un mismo estado se
 * ve igual en el Plano mobile, la leyenda y cualquier badge de la app. El
 * Plano no distingue "parcial" de "sin pago": los dos son "con saldo".
 */
export const COLOR_ESTADO = {
  pagado: { bg: 'bg-ink', border: 'border-ink', text: 'text-on-ink' },
  // Ocupada SIN distinguir saldo: la única que ve el cliente en el Plano en pantalla completa (modo cliente).
  ocupada: { bg: 'bg-ink', border: 'border-ink', text: 'text-on-ink' },
  conSaldo: { bg: 'bg-gold', border: 'border-gold', text: 'text-on-gold' },
  sinConfirmar: { bg: 'bg-card', border: 'border-line', text: 'text-ink' },
  neutro: { bg: 'bg-surface', border: 'border-surface', text: 'text-ink-2' },
} as const

export type TipoAlquiler = keyof typeof COLOR_TIPO_ALQUILER

/** Clases de fondo+borde+texto para una barra/celda, según tipo_alquiler y estado. */
export function colorReserva(tipoAlquiler: string | null | undefined, estado?: string | null): string {
  if (estado === 'cancelada') return `${COLOR_CANCELADA.bg} ${COLOR_CANCELADA.border} ${COLOR_CANCELADA.text}`
  const c = COLOR_TIPO_ALQUILER[tipoAlquiler as TipoAlquiler]
  if (!c) return 'bg-white/5 border-white/10 text-white/40'
  return `${c.bg} ${c.border} ${c.text}`
}

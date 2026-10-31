// Formateo para exportaciones CSV (oct 2026) — distinto de `lib/format.ts`
// (que formatea para MOSTRAR en pantalla, con "$", separador de miles,
// signo menos real): un CSV lo abre Excel/Sheets, así que los montos van
// como entero plano (para que los tome como número, no como texto) y las
// etiquetas van siempre en español natural, nunca la clave técnica de la
// base. Reexporta fecha/hora de `lib/format.ts` (ya están en el formato
// correcto) para no duplicar esa lógica.

import { formatFecha, formatHora } from '../format'
import { MEDIO_PAGO_LABEL, COMPROBANTE_TIPO_LABEL, TIPO_PAGO_LABEL } from '../pagos'

// Única definición real (lib/caja.js la reexporta desde acá, no al revés —
// evita el ciclo de imports export/formatos.ts <-> lib/caja.js).
export const CATEGORIA_GASTO_LABEL: Record<string, string> = {
  proveedores: 'Proveedores',
  sueldos_adelantos: 'Sueldos / Adelantos',
  mantenimiento: 'Mantenimiento',
  limpieza: 'Limpieza',
  insumos: 'Insumos',
  servicios: 'Servicios',
  retiro_dueno: 'Retiro del dueño',
  otros: 'Otros',
}

/**
 * Emoji por categoría de gasto (31/10/2026) — para que el select de
 * "Registrar Gasto" tenga el mismo lenguaje visual que el de medio de pago
 * en "Registrar Pago" (ver MEDIO_PAGO_EMOJI en lib/pagos.js). Solo adorno de
 * UI: no se exporta a CSV ni se imprime.
 */
export const CATEGORIA_GASTO_EMOJI: Record<string, string> = {
  proveedores: '📦',
  sueldos_adelantos: '👷',
  mantenimiento: '🔧',
  limpieza: '🧹',
  insumos: '🧺',
  servicios: '💡',
  retiro_dueno: '🏦',
  otros: '📌',
}

/** DD/MM/AAAA */
export const formatFechaCsv = formatFecha

/** HH:MM (24h) */
export const formatHoraCsv = formatHora

/** Entero plano, sin "$" ni separador de miles — para que Excel lo trate como número. Null/undefined → ''. */
export function formatMontoCsv(n: number | null | undefined): string {
  if (n == null) return ''
  return String(Math.round(Number(n)))
}

const ESTADO_PAGO_LABEL: Record<string, string> = {
  pendiente: 'Sin pago',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
  pendiente_confirmacion: 'Sin confirmar',
}

const ESTADO_COMPROBANTE_LABEL: Record<string, string> = {
  vigente: 'Vigente',
  anulado: 'Anulado',
}

const ESTADO_CAJA_LABEL: Record<string, string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
}

const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  cobro: 'Cobro',
  gasto: 'Gasto',
}

const SIN_COMPROBANTE_LABEL = 'Sin comprobante'

// Mapa único de etiquetas legibles — un solo lugar para no repetir "recibo_b
// -> Recibo B" ni similares en cada módulo que exporte CSV. Combina los
// labels que ya existían repartidos en lib/pagos.js / lib/caja.js (para no
// duplicarlos) con los que son específicos de exportación.
const ETIQUETAS: Record<string, Record<string, string>> = {
  medio_pago: MEDIO_PAGO_LABEL,
  comprobante_tipo: COMPROBANTE_TIPO_LABEL,
  tipo_pago: TIPO_PAGO_LABEL,
  categoria_gasto: CATEGORIA_GASTO_LABEL,
  estado_pago: ESTADO_PAGO_LABEL,
  estado_comprobante: ESTADO_COMPROBANTE_LABEL,
  estado_caja: ESTADO_CAJA_LABEL,
  tipo_movimiento: TIPO_MOVIMIENTO_LABEL,
}

/** Clave técnica -> etiqueta legible en español. Si no está mapeada, devuelve la clave tal cual (nunca revienta el export). */
export function etiqueta(grupo: keyof typeof ETIQUETAS, clave: string | null | undefined): string {
  if (!clave) return ''
  return ETIQUETAS[grupo]?.[clave] || clave
}

export function etiquetaComprobante(tipo: string | null | undefined): string {
  if (!tipo) return SIN_COMPROBANTE_LABEL
  return (COMPROBANTE_TIPO_LABEL as Record<string, string>)[tipo] || tipo
}

/** "Carpa 19" / "Sombrilla 4" en notación de playa corta: "C.19" / "S.4". */
export function unidadNotacionCsv(tipo: string | null | undefined, numero: number | string | null | undefined): string {
  if (!tipo || numero == null) return ''
  const prefijo = tipo === 'carpa' ? 'C' : tipo === 'sombrilla' ? 'S' : tipo === 'cabina' ? 'CB' : tipo === 'locker' ? 'L' : tipo.charAt(0).toUpperCase()
  return `${prefijo}.${numero}`
}

import { fechaAR } from './fechas'

// Minutos que faltan para las 00:00 ART (cuando el sistema cierra solo la caja abierta).
export function minutosParaMedianoche(ahora = new Date()) {
  const hora = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false })
  const [h, m, s] = hora.split(':').map(Number)
  return Math.ceil((24 * 3600 - (h * 3600 + m * 60 + s)) / 60)
}

// Aviso de cierre inminente: desde las 23:30 ART (30 min) y más fuerte desde las 23:55 (5 min).
export function nivelAvisoCierre(ahora = new Date()) {
  const falta = minutosParaMedianoche(ahora)
  if (falta <= 5) return { nivel: 'urgente', falta }
  if (falta <= 30) return { nivel: 'aviso', falta }
  return null
}

// Cajas cerradas automáticamente a las que todavía les falta el arqueo (y la Z), la más vieja primero.
export const cajasConArqueoPendiente = (cajas) =>
  (cajas || []).filter((c) => c.cierre_automatico && c.arqueo_pendiente).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))

// "04/11" a partir de "2026-11-04".
export const ddmm = (fecha) => (fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : '')

export { fechaAR }

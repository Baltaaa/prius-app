import { fechaAR, sumarDias } from './fechas'

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

// Notificación de alerta derivada de las cajas con arqueo pendiente (sin tabla: desaparece sola al
// completar el arqueo). Una sola, agrupada si hay más de una. `null` si no hay ninguna.
export function notificacionArqueoPendiente(cajas) {
  const pendientes = cajasConArqueoPendiente(cajas)
  if (pendientes.length === 0) return null
  const fechas = pendientes.map((c) => ddmm(c.fecha))
  const unica = pendientes.length === 1
  return {
    id: 'arqueo-pendiente',
    tipo: 'arqueo_pendiente',
    alerta: true,
    titulo: unica
      ? `La caja del ${fechas[0]} se cerró automáticamente a las 00:00. Falta hacer el arqueo y la Z.`
      : `${pendientes.length} cajas cerradas automáticamente: falta arqueo y Z`,
    detalle: unica ? null : fechas.join(', '),
    // Una: Caja en esa fecha con el arqueo listo para completar. Varias: Caja en la más vieja, con la lista a la vista.
    ruta_destino: unica ? `/app/caja?fecha=${pendientes[0].fecha}&cerrar=1` : `/app/caja?fecha=${pendientes[0].fecha}`,
    // El cierre ocurrió a las 00:00 ART del día siguiente a la caja pendiente más reciente.
    creada_at: new Date(`${sumarDias(pendientes[pendientes.length - 1].fecha, 1)}T00:00:00-03:00`).toISOString(),
    clave_agrupacion: null,
  }
}

export { fechaAR }

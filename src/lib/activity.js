import { ACTIVITY_STORAGE_KEY, ACTIVITY_CHANNEL_NAME } from '../config/session'

// Única forma de marcar actividad (Tarea 3, oct 2026): escribe el timestamp
// en localStorage (sobrevive a cerrar la pestaña y recargar) y lo
// retransmite por BroadcastChannel para que las otras pestañas abiertas
// renueven su propio contador sin tener que leer localStorage por polling.
let channel = null
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(ACTIVITY_CHANNEL_NAME)
  return channel
}

export function markActivity() {
  const now = Date.now()
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now))
  } catch {
    // localStorage puede fallar en modo privado estricto; no es crítico acá.
  }
  getChannel()?.postMessage({ type: 'activity', at: now })
  return now
}

export function getLastActivity() {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

export function broadcastLogout() {
  getChannel()?.postMessage({ type: 'logout' })
}

// Seguimiento (oct 2026): el motivo del logout por inactividad viajaba solo
// por querystring (`navigate('/login?motivo=inactividad')`), pero compite
// con el propio redirect de `PrivateRoute` cuando `session` pasa a null
// (su `<Navigate to="/login">` no lleva el query) — carrera real, confirmada
// en QA: a veces gana el redirect sin query y el banner no se muestra.
// sessionStorage no tiene ese problema de timing: se escribe antes de
// signOut() y Login.jsx lo lee al montar, sin depender de quién ganó la
// navegación.
const LOGOUT_MOTIVO_KEY = 'prius_logout_motivo'

export function setLogoutMotivo(motivo) {
  try {
    sessionStorage.setItem(LOGOUT_MOTIVO_KEY, motivo)
  } catch {
    // noop
  }
}

export function consumeLogoutMotivo() {
  try {
    const motivo = sessionStorage.getItem(LOGOUT_MOTIVO_KEY)
    if (motivo) sessionStorage.removeItem(LOGOUT_MOTIVO_KEY)
    return motivo
  } catch {
    return null
  }
}

export function subscribeActivityChannel(handler) {
  const ch = getChannel()
  if (!ch) return () => {}
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}

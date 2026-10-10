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

export function subscribeActivityChannel(handler) {
  const ch = getChannel()
  if (!ch) return () => {}
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}

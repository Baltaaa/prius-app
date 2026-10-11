// Única fuente de las constantes de sesión (Tarea 3, oct 2026).
// Cambiar acá, nunca hardcodear estos valores en otro archivo.

// Overrides opcionales por env var (Tarea 1 del seguimiento, oct 2026) —
// solo para cronometrar el QA de inactividad en local con tiempos cortos
// sin tocar el valor de producción. Sin VITE_INACTIVITY_TIMEOUT_MS /
// VITE_WARNING_BEFORE_MS seteadas (nunca lo están en Cloudflare Pages),
// quedan los defaults de siempre: 15 min / 2 min.
const envTimeout = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MS)
const envWarning = Number(import.meta.env.VITE_WARNING_BEFORE_MS)

export const INACTIVITY_TIMEOUT_MS = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 15 * 60 * 1000 // 15 min
export const WARNING_BEFORE_MS = Number.isFinite(envWarning) && envWarning > 0 ? envWarning : 2 * 60 * 1000 // aviso "¿Seguís ahí?" a los 13 min
export const CHECK_INTERVAL_MS = 15 * 1000 // poll contra localStorage (timers se congelan en mobile)

export const ACTIVITY_STORAGE_KEY = 'prius_last_activity'
export const ACTIVITY_CHANNEL_NAME = 'prius-activity'

// Login (Tarea 4d): bloqueo client-side tras intentos fallidos, complementa
// el rate limit nativo de Supabase.
export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_LOCKOUT_MS = 60 * 1000

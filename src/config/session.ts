// Única fuente de las constantes de sesión (Tarea 3, oct 2026).
// Cambiar acá, nunca hardcodear estos valores en otro archivo.

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000 // 15 min
export const WARNING_BEFORE_MS = 2 * 60 * 1000 // aviso "¿Seguís ahí?" a los 13 min
export const CHECK_INTERVAL_MS = 15 * 1000 // poll contra localStorage (timers se congelan en mobile)

export const ACTIVITY_STORAGE_KEY = 'prius_last_activity'
export const ACTIVITY_CHANNEL_NAME = 'prius-activity'

// Login (Tarea 4d): bloqueo client-side tras intentos fallidos, complementa
// el rate limit nativo de Supabase.
export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_LOCKOUT_MS = 60 * 1000

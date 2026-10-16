import { createClient } from '@supabase/supabase-js'

// Única fuente de la URL/anon key: variables de entorno (VITE_SUPABASE_URL,
// VITE_SUPABASE_ANON_KEY), nunca hardcodeadas en el repo — configuradas en
// .env.local para desarrollo y en Cloudflare Pages (Production) para el deploy.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — revisá las variables de entorno.')
}

// Seguridad de sesión (oct 2026): la sesión vive en sessionStorage, no en
// localStorage. Sobrevive a un F5 (sessionStorage persiste dentro de la
// misma pestaña) pero muere al cerrar la pestaña o el navegador — en la PC
// compartida del balneario, cerrar la pestaña ya no deja la sesión abierta
// para quien abra prius-app.pages.dev después. El timeout de 15 min por
// inactividad (PrivateRoute + useInactivityLogout) sigue igual, es una
// capa aparte. "Continuar donde lo dejaste" de Chrome puede restaurar
// sessionStorage igual que localStorage — eso lo cubre el chequeo de
// última actividad al arrancar, que usa localStorage (ver limpiarSesionVieja
// más abajo y PrivateRoute).
const AUTH_STORAGE_KEY = 'prius-app-auth-token'

// Limpieza de la sesión vieja persistida en localStorage (se escribía ahí
// hasta esta migración a sessionStorage): sin esto, un usuario que ya tenía
// la PC abierta seguiría logueado para siempre vía la copia en localStorage,
// que supabase-js nunca vuelve a leer pero que tampoco se borra sola. Barre
// además cualquier `sb-*-auth-token` default (por si alguna vez se usó sin
// storageKey explícito) y la propia clave custom.
function limpiarSesionViejaDeLocalStorage() {
  try {
    const keys = Object.keys(window.localStorage)
    for (const key of keys) {
      if (key === AUTH_STORAGE_KEY || /^sb-.*-auth-token$/.test(key)) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // localStorage puede no estar disponible (modo privado estricto) — no es crítico.
  }
}
limpiarSesionViejaDeLocalStorage()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage,
    storageKey: AUTH_STORAGE_KEY
  }
})

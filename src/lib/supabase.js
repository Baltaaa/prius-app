import { createClient } from '@supabase/supabase-js'

// Única fuente de la URL/anon key: variables de entorno (VITE_SUPABASE_URL,
// VITE_SUPABASE_ANON_KEY), nunca hardcodeadas en el repo — configuradas en
// .env.local para desarrollo y en Cloudflare Pages (Production) para el deploy.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — revisá las variables de entorno.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'prius-app-auth-token'
  }
})

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { tienePermiso } from '../lib/permisos'

const AuthContext = createContext(null)

// Fuente única de sesión + perfil (rol/activo/debe_cambiar_password) de
// toda la app — Tarea 4 (guía Roles/Login). `loading` cubre el momento
// "resolviendo sesión": PrivateRoute no debe decidir nada hasta que sea false,
// para no mostrar ni el login ni contenido protegido de arriba.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchPerfil = useCallback(async (userId) => {
    if (!userId) { setPerfil(null); return }
    const { data } = await supabase.from('perfiles').select('*').eq('user_id', userId).maybeSingle()
    setPerfil(data || null)
  }, [])

  useEffect(() => {
    let activo = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!activo) return
      setSession(session)
      await fetchPerfil(session?.user?.id)
      if (activo) setLoading(false)
    })

    // No awaitar trabajo async (fetchPerfil pega a la base) directo adentro
    // del callback: onAuthStateChange lo corre bajo el lock interno de
    // gotrue-js (navigator.locks sobre el storageKey), y un signIn/signOut
    // concurrente que necesite ese mismo lock queda bloqueado hasta que
    // gotrue lo libera a la fuerza a los 5s — el login quedaba colgado
    // (confirmado en producción: "Lock ... was not released within 5000ms").
    // setTimeout saca el trabajo afuera del lock, como recomienda Supabase.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        setPerfil(null)
        setLoading(false)
        return
      }
      setTimeout(() => {
        fetchPerfil(session?.user?.id).then(() => setLoading(false))
      }, 0)
    })

    return () => { activo = false; subscription.unsubscribe() }
  }, [fetchPerfil])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setPerfil(null)
  }, [])

  const refetchPerfil = useCallback(() => fetchPerfil(session?.user?.id), [fetchPerfil, session])

  const activo = perfil?.activo === true
  const rol = activo ? perfil.rol : null

  const value = {
    session, perfil, loading, signOut, refetchPerfil,
    activo, rol,
    permiso: (clave) => tienePermiso(rol, clave),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function usePermiso(clave) {
  const { permiso } = useAuth()
  return permiso(clave)
}

export function Permiso({ clave, children }) {
  const puede = usePermiso(clave)
  return puede ? children : null
}

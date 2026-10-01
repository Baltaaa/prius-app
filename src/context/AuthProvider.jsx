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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        setPerfil(null)
        setLoading(false)
        return
      }
      await fetchPerfil(session?.user?.id)
      setLoading(false)
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

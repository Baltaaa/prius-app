import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { tienePermiso } from '../lib/permisos'
import { setLogoutMotivo } from '../lib/activity'

const AuthContext = createContext(null)

// Seguimiento (oct 2026, Tarea 2): único lugar que escribe "Inicio de
// sesión"/"Cierre de sesión"/"Cierre por inactividad" en `eventos`, vía la
// RPC `fn_registrar_evento_auth` (nunca un insert directo — mismo patrón
// que el resto de la app). Fire-and-forget con try/catch propio: un fallo
// acá nunca bloquea ni demora el login/logout real.
async function logAuthEvent(tipoEvento) {
  try {
    await supabase.rpc('fn_registrar_evento_auth', { p_tipo_evento: tipoEvento })
  } catch {
    // No bloquea el flujo de auth — el Historial puede perder una fila,
    // pero el login/logout tiene que funcionar igual.
  }
}

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
      // "Inicio de sesión" (Tarea 2): solo en un SIGNED_IN real, nunca en
      // INITIAL_SESSION (restauración de sesión persistida al refrescar) ni
      // en TOKEN_REFRESHED — si no, se loguearía un "login" en cada
      // recarga de página. No se awaita: no puede demorar el fetch de
      // perfil ni la navegación del login.
      if (event === 'SIGNED_IN') {
        logAuthEvent('login')
      }

      // Bug del doble login (oct 2026): este evento llega con `perfil` todavía
      // desactualizado (del usuario anterior o null en un login nuevo). Sin
      // volver a poner loading=true acá, PrivateRoute podía renderizar con
      // loading=false + perfil todavía null y tratarlo como "sin acceso"
      // -> signOut() -> rebote a /login en el primer intento.
      setLoading(true)
      setTimeout(() => {
        fetchPerfil(session?.user?.id).then(() => setLoading(false))
      }, 0)
    })

    return () => { activo = false; subscription.unsubscribe() }
  }, [fetchPerfil])

  // `motivo`: 'logout' (default, botón manual) | 'logout_inactividad' (cierre
  // automático por inactividad). Único lugar de la app que cierra sesión —
  // el evento de Historial se inserta ACÁ, antes de invalidar la sesión
  // (si no, auth.uid() ya no resuelve del lado del servidor y se pierde el
  // usuario real del evento).
  const signOut = useCallback(async (motivo = 'logout') => {
    if (motivo === 'logout_inactividad') setLogoutMotivo('inactividad')
    await logAuthEvent(motivo)
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

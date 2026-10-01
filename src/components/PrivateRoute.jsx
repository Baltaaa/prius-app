import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import GlobalLoader from './ui/GlobalLoader'

// Ruta protegida (Tarea 4): sin sesión -> /login (guarda la ruta para volver
// después). Con sesión pero sin perfil activo -> cierra sesión y avisa. Con
// debe_cambiar_password -> bloquea el resto de la app. `clave` opcional
// valida permiso puntual (ver lib/permisos.ts) — sin permiso, Home + aviso.
export default function PrivateRoute({ children, clave }) {
  const { session, perfil, loading, activo, permiso, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <GlobalLoader message="Verificando credenciales de seguridad" />

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (!perfil || !activo) {
    signOut()
    return <Navigate to="/login" state={{ sinAcceso: true }} replace />
  }

  if (perfil.debe_cambiar_password && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" state={{ from: location.pathname }} replace />
  }

  if (clave && !permiso(clave)) {
    return <Navigate to="/app/home" state={{ sinPermiso: true }} replace />
  }

  return children
}

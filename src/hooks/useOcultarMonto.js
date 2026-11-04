import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthProvider'

// "Ojito" de los montos sensibles (como en las billeteras virtuales): la
// preferencia se recuerda por usuario en localStorage. Todo acceso va con
// try/catch: en ventana privada o con el storage bloqueado la pantalla sigue
// funcionando, solo que sin memoria.
const EVENTO = 'prius:ocultar-monto'
const clave = (userId, nombre) => `prius:ocultar-monto:${nombre}:${userId || 'anon'}`

function leer(userId, nombre) {
  try { return window.localStorage.getItem(clave(userId, nombre)) === '1' } catch { return false }
}

export function useOcultarMonto(nombre = 'caja') {
  const { session } = useAuth()
  const userId = session?.user?.id
  const [oculto, setOculto] = useState(() => leer(userId, nombre))

  // Al cambiar de usuario, o si otra instancia (ej. la card del Dashboard)
  // cambia la preferencia, se vuelve a leer.
  useEffect(() => {
    const sincronizar = () => setOculto(leer(userId, nombre))
    sincronizar()
    window.addEventListener(EVENTO, sincronizar)
    return () => window.removeEventListener(EVENTO, sincronizar)
  }, [userId, nombre])

  const alternar = useCallback(() => {
    const siguiente = !leer(userId, nombre)
    try { window.localStorage.setItem(clave(userId, nombre), siguiente ? '1' : '0') } catch { /* sin storage: solo vale esta sesión */ }
    setOculto(siguiente)
    window.dispatchEvent(new Event(EVENTO))
  }, [userId, nombre])

  return [oculto, alternar]
}

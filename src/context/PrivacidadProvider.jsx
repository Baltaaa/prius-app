import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthProvider'
import { setMontosOcultos } from '../lib/format'

// Modo privacidad GLOBAL ("ojito" de las billeteras virtuales): un solo estado para toda la app,
// guardado por usuario en localStorage (siempre con try/catch: en ventana privada o con el
// storage bloqueado la pantalla sigue funcionando, solo que sin memoria).
//
// El estado se publica en lib/format (setMontosOcultos) en cada render: formatMonto y sus
// variantes devuelven "$ ••••••" mientras esté activo. El árbol de rutas se suscribe a este
// contexto (App.jsx) para volver a renderizar todo al alternar.
const PrivacidadContext = createContext({ oculto: false, alternar: () => {}, mostrar: () => {} })

const clave = (userId) => `prius:montos-ocultos:${userId || 'anon'}`

function leer(userId) {
  try { return window.localStorage.getItem(clave(userId)) === '1' } catch { return false }
}

function guardar(userId, valor) {
  try { window.localStorage.setItem(clave(userId), valor ? '1' : '0') } catch { /* sin storage: solo vale esta sesión */ }
}

export function PrivacidadProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const [oculto, setOculto] = useState(() => leer(userId))

  // Al iniciar o cambiar de usuario se lee su preferencia.
  useEffect(() => { setOculto(leer(userId)) }, [userId])

  // Sincrónico, antes de que rendericen los hijos: así el primer pintado ya sale oculto.
  setMontosOcultos(oculto)

  const fijar = useCallback((valor) => {
    guardar(userId, valor)
    setOculto(valor)
  }, [userId])
  const alternar = useCallback(() => fijar(!leer(userId)), [fijar, userId])
  const mostrar = useCallback(() => fijar(false), [fijar])

  const value = useMemo(() => ({ oculto, alternar, mostrar }), [oculto, alternar, mostrar])
  return <PrivacidadContext.Provider value={value}>{children}</PrivacidadContext.Provider>
}

export function usePrivacidad() {
  return useContext(PrivacidadContext)
}

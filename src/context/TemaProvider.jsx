import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthProvider'
import { aplicarTema, cambiarConTransicion, consultaSistema, guardarPreferencia, leerPreferencia, resolverTema } from '../lib/tema'

// Tema claro / oscuro / sistema (DESIGN.md, "Modo oscuro"): un solo estado para
// toda la app, guardado por usuario. Los colores no viven acá: data-theme en
// <html> redefine los tokens de index.css y todo lo demás sigue igual.
const TemaContext = createContext({ preferencia: 'claro', resuelto: 'light', elegir: () => {}, alternar: () => {} })

export function TemaProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const [preferencia, setPreferencia] = useState(() => leerPreferencia(userId))
  const [resuelto, setResuelto] = useState(() => resolverTema(preferencia))

  // Al iniciar o cambiar de usuario se lee su preferencia (sin animación).
  useEffect(() => {
    const p = leerPreferencia(userId)
    const r = resolverTema(p)
    aplicarTema(r)
    setPreferencia(p)
    setResuelto(r)
  }, [userId])

  // "Sistema" sigue a prefers-color-scheme en vivo.
  useEffect(() => {
    if (preferencia !== 'sistema') return undefined
    const consulta = consultaSistema()
    if (!consulta) return undefined
    const alCambiar = () => {
      const r = resolverTema('sistema')
      aplicarTema(r)
      setResuelto(r)
    }
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [preferencia])

  const elegir = useCallback((p) => {
    guardarPreferencia(userId, p)
    const r = resolverTema(p)
    cambiarConTransicion(() => {
      aplicarTema(r)
      setPreferencia(p)
      setResuelto(r)
    })
  }, [userId])

  const alternar = useCallback(() => elegir(resuelto === 'dark' ? 'claro' : 'oscuro'), [elegir, resuelto])

  const value = useMemo(() => ({ preferencia, resuelto, elegir, alternar }), [preferencia, resuelto, elegir, alternar])
  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>
}

export function useTema() {
  return useContext(TemaContext)
}

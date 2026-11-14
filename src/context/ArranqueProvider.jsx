import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// Arranque de la app (nov 2026): el loader global no se va hasta que la
// PRIMERA pantalla está completa. Antes se iba apenas resolvía la sesión y el
// usuario veía la pantalla armándose sola (skeletons, cards apareciendo de a
// una) después del fade.
//
// Qué se espera, en AppLayout (ver ArranqueGate.jsx):
//   1. sesión y rol resueltos (AuthProvider),
//   2. las queries iniciales del DataProvider,
//   3. las queries propias de la pantalla que se abre — cada página lo avisa
//      con `useArranquePantalla(listo)`, leyendo el estado de loading que ya
//      tenía (nunca se reescribieron sus hooks),
//   4. document.fonts.ready y el logo cargado.
// Más un tope de 8s para no colgar la app si algo falla.
//
// Solo la carga inicial: una vez que el loader se fue, no vuelve nunca en
// esta carga de página (`yaArranco`, a nivel de módulo). Volver a la pestaña
// no lo muestra de nuevo.
const ArranqueContext = createContext(null)

let yaArranco = false

export function ArranqueProvider({ children }) {
  const [pendientes, setPendientes] = useState(() => new Set())
  const proximoId = useRef(0)

  const registrar = useCallback(() => {
    const id = ++proximoId.current
    setPendientes((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    return id
  }, [])

  const resolver = useCallback((id) => {
    setPendientes((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ pantallasPendientes: pendientes.size, registrar, resolver, yaArranco: () => yaArranco, marcarArrancado: () => { yaArranco = true } }),
    [pendientes, registrar, resolver],
  )
  return <ArranqueContext.Provider value={value}>{children}</ArranqueContext.Provider>
}

export function useArranque() {
  return useContext(ArranqueContext)
}

/**
 * Una pantalla avisa si sus datos iniciales ya están. `listo` es el mismo
 * booleano que la página ya usaba para decidir entre skeleton y contenido
 * (normalmente `useInitialLoad(loading)`): este hook no toca esa lógica, solo
 * retiene el loader global hasta que sea true la primera vez.
 *
 * Fuera del AppLayout (tests, vistas sueltas) no hay provider y no hace nada.
 */
export function useArranquePantalla(listo) {
  const arranque = useContext(ArranqueContext)
  const idRef = useRef(null)

  useEffect(() => {
    if (!arranque || yaArranco) return undefined
    idRef.current = arranque.registrar()
    const id = idRef.current
    return () => arranque.resolver(id)
    // Se registra UNA vez por montaje de la pantalla; `listo` lo resuelve el
    // efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!arranque || !listo || idRef.current == null) return
    arranque.resolver(idRef.current)
    idRef.current = null
  }, [arranque, listo])
}

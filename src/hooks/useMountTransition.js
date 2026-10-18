import { useEffect, useRef, useState } from 'react'

// Animación de apertura/cierre única para todo lo que se abre por
// interacción (modales, bottom sheets, dropdowns, popovers, paneles) — B1,
// oct 2026. Antes del rediseño, estos componentes usaban clases del plugin
// `tailwindcss-animate` (`animate-in fade-in slide-in-from-bottom...`) que
// NUNCA estuvieron registradas en tailwind.config.js (`plugins: []`) — eran
// no-ops silenciosos, nunca animaron nada. Este hook + las clases `.ui-*`
// de src/index.css son el reemplazo real.
//
// Por qué un hook y no solo CSS: un `{isOpen && <Overlay/>}` desmonta el
// nodo del DOM antes de que cualquier transición de salida pueda correr —
// no hay forma de animar un cierre con CSS puro si React ya lo sacó del
// árbol. Este hook mantiene el componente montado `exitMs` de más cuando
// `isOpen` pasa a false, tiempo justo para que termine la animación
// `.ui-close*`, y recién ahí deja de renderizar.
//
// Uso:
//   const shouldRender = useMountTransition(isOpen)
//   if (!shouldRender) return null
//   <div className={isOpen ? 'ui-open' : 'ui-close'}>...</div>
export function useMountTransition(isOpen, exitMs = 150) {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const timerRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      setShouldRender(true)
      return
    }
    if (shouldRender) {
      timerRef.current = setTimeout(() => setShouldRender(false), exitMs)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, exitMs])

  return shouldRender
}

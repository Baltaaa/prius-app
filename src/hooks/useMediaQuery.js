import { useEffect, useState } from 'react'

/**
 * Breakpoint evaluado en JS, no en CSS.
 *
 * Hace falta cuando lo que se muestra o se esconde vive en un PORTAL: un
 * `<div className="lg:hidden">` alrededor de un portal no esconde nada,
 * porque el contenido se renderiza en document.body, fuera de ese div (bug
 * real, nov 2026: el bottom sheet del Historial aparecía también en
 * desktop). En ese caso hay que no montarlo, y eso se decide acá.
 *
 * Para todo lo demás, seguir usando las variantes de Tailwind.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])
  return matches
}

/** `true` en desktop (≥1024px), donde el detalle va en panel y no en sheet. */
export const useEsDesktop = () => useMediaQuery('(min-width: 1024px)')

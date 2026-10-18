import { useEffect, useRef, useState } from 'react'

// Loading unificado por sección (B2, oct 2026): el contenedor principal de
// una pantalla no muestra nada hasta que TODAS sus requests iniciales
// terminan — un solo skeleton de la sección completa en vez de que cada
// card aparezca por separado (el bug real: en Home las stats aparecían
// primero y el clima, segundos después, por separado). Pasa el `loading`
// ya combinado de los hooks de la pantalla (ej. `resLoading || cajaLoading`)
// — este hook no toca esa lógica, solo decide CUÁNDO mostrar contenido.
//
// "Solo aplica a la carga inicial" (regla explícita): una vez que
// `ready` pasa a true, se congela ahí para siempre vía `doneRef` — un
// refetch de Realtime que vuelva a poner `loading=true` más tarde NUNCA
// vuelve a mostrar el skeleton.
export function useInitialLoad(loading) {
  const [ready, setReady] = useState(!loading)
  const doneRef = useRef(!loading)

  useEffect(() => {
    if (doneRef.current) return // ya se resolvió una vez, no vuelve a mostrar skeleton
    if (!loading) {
      doneRef.current = true
      setReady(true)
    }
  }, [loading])

  return ready
}

// Timeout para una request lenta aislada (clima/Windguru u otras APIs
// externas, B2): pasados `ms` sin resolver, se trata como "terminada" (el
// llamador queda con su propio estado real — si seguía null/sin dato,
// renderiza su card en el estado "no disponible" del mismo tamaño, sin
// bloquear al resto de la sección). No modifica el hook de origen ni su
// query — solo decide hasta cuándo esperarlo antes de seguir sin él.
export function useTimeoutFallback(loading, ms = 4000) {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) {
      setTimedOut(false)
      return
    }
    const t = setTimeout(() => setTimedOut(true), ms)
    return () => clearTimeout(t)
  }, [loading, ms])

  return loading && !timedOut
}

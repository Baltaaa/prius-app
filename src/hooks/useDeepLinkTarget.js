import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDialog } from '../context/DialogProvider'
import { scrollAndHighlight } from '../lib/highlight'

/**
 * Consume los query params de un deep-link (builders en `lib/deepLinks.ts`)
 * al montar la pantalla: abre lo que haga falta vía `resolve`, limpia los
 * params de la URL (no quedan pegados si el usuario recarga o navega con
 * "atrás"), y una vez que el elemento destino está pintado hace
 * scrollIntoView suave + lo resalta con `.deep-link-highlight` (borde
 * #F2CA50 que se desvanece solo, ver index.css).
 *
 * `params`: nombres de query params a leer (ej. ['id', 'pago']).
 * `ready`: true cuando los datos ya cargaron y es seguro resolver (si no,
 *   el efecto espera sin consumir nada).
 * `resolve(values)`: hace los side-effects que hagan falta (expandir
 *   acordeón, abrir modal) y devuelve:
 *   - un string: el `data-deeplink-id` del elemento a resaltar con scroll;
 *   - `true`: el registro existe y el side-effect ya lo mostró (ej. un
 *     modal) — no hay nada que scrollear ni resaltar;
 *   - `false`/`null`/`undefined`: el registro no existe — toast discreto.
 *
 * El elemento destino debe tener `data-deeplink-id="<id>"` en el DOM.
 */
export function useDeepLinkTarget({ params, ready, resolve }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useDialog()
  const consumedRef = useRef(false)

  useEffect(() => {
    if (!ready || consumedRef.current) return
    const hasAny = params.some((p) => searchParams.get(p))
    if (!hasAny) return
    consumedRef.current = true

    const values = {}
    for (const p of params) values[p] = searchParams.get(p) || undefined

    const targetId = resolve(values)
    setSearchParams({}, { replace: true })

    if (!targetId) {
      toast('No se encontró el registro.')
      return
    }
    if (targetId === true) return

    // 150ms: mismo margen que ya usaba el deep-link de Clientes para dejar
    // asentado el contenido recién expandido (fetch de pagos, etc.) antes
    // de medir dónde scrollear.
    scrollAndHighlight(targetId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, searchParams])
}

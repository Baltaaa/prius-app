import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Caché stale-while-revalidate en memoria para RPCs de solo lectura (nov 2026).
//
// Por qué no React Query / SWR: el proyecto no las tiene instaladas y sumar
// una librería grande para esto no se paga. Lo único que hace falta es que
// volver a una pantalla que ya se vio sea INSTANTÁNEO: se pinta lo último que
// se trajo y se revalida por detrás. Un objeto Map en memoria alcanza.
//
// Vive en memoria del módulo (no en localStorage) a propósito: son números de
// plata y ocupación, no tienen que sobrevivir al cierre de la app ni quedar
// guardados en el dispositivo.
const cache = new Map()

/** Vacía la caché (al cerrar sesión, o cuando llega un cambio por Realtime). */
export function invalidarCacheRpc(prefijo) {
  if (!prefijo) { cache.clear(); return }
  for (const k of [...cache.keys()]) if (k.startsWith(prefijo)) cache.delete(k)
}

/**
 * Llama una RPC de Postgres y cachea el resultado por (nombre + params).
 *
 * Devuelve `{ datos, cargando, revalidando, error, refrescar }`:
 *   - `datos` sale de la caché al instante si ya se pidió antes.
 *   - `cargando` solo es true la PRIMERA vez (sin nada cacheado): es lo que
 *     decide si se muestran los skeletons.
 *   - `revalidando` es true mientras se refresca algo que ya se está viendo,
 *     para un indicador discreto sin tapar el contenido.
 *
 * `activo: false` deja la llamada sin disparar (por ejemplo hasta que haya
 * sesión o se conozcan las fechas).
 */
export function useRpc(nombre, params, { activo = true } = {}) {
  const clave = `${nombre}:${JSON.stringify(params ?? {})}`
  const [datos, setDatos] = useState(() => cache.get(clave) ?? null)
  const [cargando, setCargando] = useState(() => activo && !cache.has(clave))
  const [revalidando, setRevalidando] = useState(false)
  const [error, setError] = useState(null)
  // La clave viva: una respuesta que llega tarde, de un período que ya no es
  // el que se está mirando, se descarta en vez de pisar la pantalla.
  const claveRef = useRef(clave)

  const pedir = useCallback(async () => {
    if (!activo) return
    const mia = clave
    claveRef.current = mia
    const enCache = cache.get(mia)
    if (enCache !== undefined) {
      setDatos(enCache)
      setCargando(false)
      setRevalidando(true)
    } else {
      setCargando(true)
    }
    const { data, error: err } = await supabase.rpc(nombre, params ?? {})
    if (claveRef.current !== mia) return
    if (err) {
      setError(err.message)
      setCargando(false)
      setRevalidando(false)
      return
    }
    cache.set(mia, data)
    setDatos(data)
    setError(null)
    setCargando(false)
    setRevalidando(false)
  }, [activo, clave, nombre, params])

  useEffect(() => {
    // Pintar de entrada lo que haya cacheado para esta clave, incluso si el
    // pedido todavía no volvió (cambio de período hacia uno ya visto).
    const enCache = cache.get(clave)
    if (enCache !== undefined) { setDatos(enCache); setCargando(false) }
    else if (activo) { setDatos(null); setCargando(true) }
    pedir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo])

  return { datos, cargando, revalidando, error, refrescar: pedir }
}

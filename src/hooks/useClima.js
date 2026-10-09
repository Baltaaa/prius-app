import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Cache de módulo del lado del cliente (no localStorage: es solo para no
// repetir el fetch si el usuario va y vuelve a la misma fecha dentro de la
// misma sesión de pestaña) — la Edge Function `clima-playa` ya cachea 30
// minutos del lado del servidor, esto es una capa extra barata.
const cache = new Map() // fecha -> { at, data }
const CLIENTE_TTL_MS = 5 * 60 * 1000

/**
 * Clima para `fecha` (yyyy-mm-dd), vía la Edge Function `clima-playa`
 * (Open-Meteo forecast + marine, coordenadas de `src/config/clima.ts`).
 * Fetch aislado del resto del Plano: nunca bloquea ni demora el render de
 * las unidades — `loading` acá solo afecta al chip de clima.
 */
export function useClima(fecha) {
  const [clima, setClima] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!fecha) return
    let activo = true

    const cached = cache.get(fecha)
    if (cached && Date.now() - cached.at < CLIENTE_TTL_MS) {
      setClima(cached.data)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    supabase.functions
      .invoke(`clima-playa?fecha=${fecha}`, { method: 'GET' })
      .then(({ data, error: err }) => {
        if (!activo) return
        if (err) {
          setError(err)
          setClima(null)
          return
        }
        cache.set(fecha, { at: Date.now(), data })
        setClima(data)
        setError(null)
      })
      .catch((err) => { if (activo) { setError(err); setClima(null) } })
      .finally(() => { if (activo) setLoading(false) })

    return () => { activo = false }
  }, [fecha])

  return { clima, loading, error }
}

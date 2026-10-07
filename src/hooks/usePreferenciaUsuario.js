import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Preferencia simple por usuario (Tarea 6, feat-9, oct 2026) — tabla
 * `preferencias_usuario` (usuario, clave, valor jsonb), sin localStorage.
 * Uso: const [reservaId, setReservaId] = usePreferenciaUsuario('comprobantes_ultima_reserva', '')
 */
export function usePreferenciaUsuario(clave, defaultValue) {
  const [valor, setValor] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let activo = true
    supabase.from('preferencias_usuario').select('valor').eq('clave', clave).maybeSingle()
      .then(({ data }) => {
        if (activo && data?.valor !== undefined) setValor(data.valor)
        if (activo) setLoaded(true)
      })
    return () => { activo = false }
  }, [clave])

  const guardar = useCallback((nuevoValor) => {
    setValor(nuevoValor)
    supabase.auth.getUser().then(({ data }) => {
      const usuario = data?.user?.id
      if (!usuario) return
      supabase.from('preferencias_usuario').upsert({ usuario, clave, valor: nuevoValor, updated_at: new Date().toISOString() })
    })
  }, [clave])

  return [valor, guardar, loaded]
}

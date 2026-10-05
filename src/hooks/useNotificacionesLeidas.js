import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Estado de lectura de notificaciones (ítem 3, oct 2026) — las notificaciones
// en sí siguen siendo COMPUTADAS (useNotifications.js, a partir de
// reservas/caja, no hay un segundo sistema de escritura); lo único que se
// persiste por usuario es qué ids sintéticos ("checkin-<id>", "saldo-<id>",
// "caja-pendiente") ya marcó como leídos, en notificaciones_leidas.
export function useNotificacionesLeidas() {
  const [leidas, setLeidas] = useState(() => new Set())
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('notificaciones_leidas').select('notificacion_id')
    if (!error && data) setLeidas(new Set(data.map((r) => r.notificacion_id)))
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const marcarLeida = useCallback(async (notificacionId) => {
    setLeidas((prev) => new Set(prev).add(notificacionId))
    const { data: userData } = await supabase.auth.getUser()
    const usuario = userData?.user?.id
    if (!usuario) return
    // ignoreDuplicates -> ON CONFLICT DO NOTHING: no pisa nada si ya estaba
    // marcada (no hay policy de UPDATE a propósito, ver la migración).
    await supabase.from('notificaciones_leidas').upsert({ usuario, notificacion_id: notificacionId }, { ignoreDuplicates: true })
  }, [])

  const marcarTodas = useCallback(async (ids) => {
    setLeidas((prev) => new Set([...prev, ...ids]))
    const { data: userData } = await supabase.auth.getUser()
    const usuario = userData?.user?.id
    if (!usuario || ids.length === 0) return
    await supabase.from('notificaciones_leidas').upsert(
      ids.map((notificacion_id) => ({ usuario, notificacion_id })),
      { ignoreDuplicates: true },
    )
  }, [])

  return { leidas, loading, marcarLeida, marcarTodas }
}

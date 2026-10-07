import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)

/**
 * Estado de lectura de notificaciones, COMPARTIDO (Tarea 3, oct 2026) — el
 * bug real: antes `useNotificacionesLeidas` era un hook con su propio
 * `useState`, así que Sidebar, BottomNav, TopBar y Notificaciones.jsx cada
 * uno montaba su PROPIA instancia con su propio Set, cada una leída una
 * sola vez al montar. Marcar como leída en una pantalla actualizaba esa
 * instancia nomás — las otras tres seguían mostrando el badge viejo hasta
 * el próximo refresh de página. Un solo provider, montado una vez en
 * AppLayout, resuelve eso: todos los consumidores leen y escriben el mismo
 * Set.
 *
 * Las notificaciones en sí siguen siendo COMPUTADAS (useNotifications.js,
 * a partir de reservas/caja/eventos) — lo único que se persiste por
 * usuario es qué ids sintéticos ("checkin-<id>", "saldo-<id>",
 * "caja-pendiente") ya marcó como leídos, en `notificaciones_leidas`.
 */
export function NotificacionesLeidasProvider({ children }) {
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

  // Sync entre dispositivos (Tarea 3): requiere que `notificaciones_leidas`
  // esté en la publication `supabase_realtime` — pendiente de confirmación
  // (ver ALTER PUBLICATION propuesto). Mientras no esté, este canal se
  // suscribe pero Postgres nunca le manda nada; no rompe nada, solo no
  // sincroniza entre pestañas/dispositivos todavía.
  useEffect(() => {
    const channel = supabase
      .channel('notificaciones-leidas-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones_leidas' },
        (payload) => {
          const id = payload.new?.notificacion_id
          if (id) setLeidas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const marcarLeida = useCallback(async (notificacionId) => {
    setLeidas((prev) => (prev.has(notificacionId) ? prev : new Set(prev).add(notificacionId)))
    const { data: userData } = await supabase.auth.getUser()
    const usuario = userData?.user?.id
    if (!usuario) return
    // ignoreDuplicates -> ON CONFLICT DO NOTHING: no pisa nada si ya estaba
    // marcada (no hay policy de UPDATE a propósito, ver la migración).
    await supabase.from('notificaciones_leidas').upsert({ usuario, notificacion_id: notificacionId }, { ignoreDuplicates: true })
  }, [])

  const marcarTodas = useCallback(async (ids) => {
    if (ids.length === 0) return
    setLeidas((prev) => new Set([...prev, ...ids]))
    const { data: userData } = await supabase.auth.getUser()
    const usuario = userData?.user?.id
    if (!usuario) return
    await supabase.from('notificaciones_leidas').upsert(
      ids.map((notificacion_id) => ({ usuario, notificacion_id })),
      { ignoreDuplicates: true },
    )
  }, [])

  return (
    <Ctx.Provider value={{ leidas, loading, marcarLeida, marcarTodas }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotificacionesLeidas() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotificacionesLeidas debe usarse dentro de <NotificacionesLeidasProvider>')
  return ctx
}

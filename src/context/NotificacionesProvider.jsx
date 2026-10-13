import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

const Ctx = createContext(null)

/**
 * Modelo "bandeja de pendientes" (oct 2026) — reemplaza por completo al
 * viejo sistema (useNotifications.js + NotificacionesLeidasProvider.jsx,
 * borrados). Las notificaciones ya NO se computan en el front: viven en
 * `notificaciones` (compartida, solo la escriben triggers de Postgres vía
 * SECURITY DEFINER) + `notificaciones_usuario` (estado de lectura por
 * usuario, solo para categoria='novedad' — las pendientes no tienen
 * "leída", se resuelven solas).
 *
 * Única suscripción Realtime de todo el módulo, montada acá una vez
 * (AppLayout) y consumida por la campana, el panel y el badge del
 * Sidebar/BottomNav vía `useNotificaciones()`.
 */
export function NotificacionesProvider({ children }) {
  const { session } = useAuth()
  const usuarioId = session?.user?.id || null

  const [pendientes, setPendientes] = useState([])
  const [novedades, setNovedades] = useState([]) // { ...notificacion, leida_at, archivada_at }
  const [loading, setLoading] = useState(true)

  const fetchPendientes = useCallback(async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('categoria', 'pendiente')
      .is('resuelta_at', null)
      .order('creada_at', { ascending: false })
    if (!error) setPendientes(data || [])
  }, [])

  // Embed notificaciones(*) vía el FK notificaciones_usuario->notificaciones
  // — un solo request. `expira_at` se filtra acá (fetch-time, sin pg_cron,
  // ver CLAUDE.md "Limpieza automática") en vez de en la query: PostgREST
  // no deja filtrar por columna del embed sin !inner, y el resto de la app
  // ya filtra en memoria sobre datos ya traídos (mismo patrón de siempre).
  const fetchNovedades = useCallback(async () => {
    if (!usuarioId) { setNovedades([]); return }
    const { data, error } = await supabase
      .from('notificaciones_usuario')
      .select('leida_at, archivada_at, notificaciones(*)')
      .eq('usuario_id', usuarioId)
      .is('archivada_at', null)
      .order('notificacion_id', { ascending: false })
    if (error) return
    const ahora = Date.now()
    const vivas = (data || [])
      .filter((row) => row.notificaciones && (!row.notificaciones.expira_at || new Date(row.notificaciones.expira_at).getTime() > ahora))
      .map((row) => ({ ...row.notificaciones, leida_at: row.leida_at, archivada_at: row.archivada_at }))
      .sort((a, b) => new Date(b.creada_at) - new Date(a.creada_at))
    setNovedades(vivas)
  }, [usuarioId])

  const refetch = useCallback(async () => {
    await Promise.all([fetchPendientes(), fetchNovedades()])
  }, [fetchPendientes, fetchNovedades])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  // Realtime: un write en `notificaciones` (nueva pendiente, o una se
  // resuelve) o en `notificaciones_usuario` (nueva novedad para mí, o
  // marco leída/archivada desde otra pestaña/dispositivo) -> refetch
  // acotado. RLS ya filtra qué filas de notificaciones_usuario le llegan a
  // cada cliente (solo las propias), así que esto nunca refresca de más.
  const debounceRef = useRef(null)
  useEffect(() => {
    if (!usuarioId) return
    const channel = supabase
      .channel('notificaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(refetch, 200)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones_usuario' }, () => {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(refetch, 200)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [usuarioId, refetch])

  const marcarNovedadesVistas = useCallback(async () => {
    if (!usuarioId) return
    const idsNoLeidas = novedades.filter((n) => !n.leida_at).map((n) => n.id)
    if (idsNoLeidas.length === 0) return
    const ahora = new Date().toISOString()
    setNovedades((prev) => prev.map((n) => (idsNoLeidas.includes(n.id) ? { ...n, leida_at: n.leida_at || ahora } : n)))
    await supabase
      .from('notificaciones_usuario')
      .update({ leida_at: ahora })
      .eq('usuario_id', usuarioId)
      .in('notificacion_id', idsNoLeidas)
      .is('leida_at', null)
  }, [usuarioId, novedades])

  const archivarNovedad = useCallback(async (notificacionId) => {
    if (!usuarioId) return
    const ahora = new Date().toISOString()
    setNovedades((prev) => prev.filter((n) => n.id !== notificacionId))
    await supabase
      .from('notificaciones_usuario')
      .update({ archivada_at: ahora, leida_at: ahora })
      .eq('usuario_id', usuarioId)
      .eq('notificacion_id', notificacionId)
      .is('archivada_at', null)
  }, [usuarioId])

  const marcarTodoLeido = useCallback(async () => {
    if (!usuarioId) return
    const ids = novedades.map((n) => n.id)
    if (ids.length === 0) return
    const ahora = new Date().toISOString()
    setNovedades([])
    await supabase
      .from('notificaciones_usuario')
      .update({ archivada_at: ahora, leida_at: ahora })
      .eq('usuario_id', usuarioId)
      .in('notificacion_id', ids)
      .is('archivada_at', null)
  }, [usuarioId, novedades])

  const countNovedadesNoLeidas = useMemo(() => novedades.filter((n) => !n.leida_at).length, [novedades])

  const value = useMemo(() => ({
    loading,
    pendientes,
    novedades,
    countPendientes: pendientes.length,
    countNovedadesNoLeidas,
    marcarNovedadesVistas,
    archivarNovedad,
    marcarTodoLeido,
    refetch,
  }), [loading, pendientes, novedades, countNovedadesNoLeidas, marcarNovedadesVistas, archivarNovedad, marcarTodoLeido, refetch])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotificaciones() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotificaciones debe usarse dentro de <NotificacionesProvider>')
  return ctx
}

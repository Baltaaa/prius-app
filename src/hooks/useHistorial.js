import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

// Hook del Historial unificado (ítem 2, oct 2026; paginado real agregado
// Tarea 4, oct 2026). Para tipo='global' pagina directo contra `eventos`
// (antes leía el array de 300 eventos ya cargado en DataProvider, sin
// paginar de verdad) — acepta filtros de usuario/unidad/cliente/tipo de
// evento/rango de fechas/búsqueda libre. Para 'cliente'/'reserva'/'unidad'
// sigue paginando contra la RPC historial_entidad (resuelve los joins
// server-side). En los dos casos, un canal Realtime agrega eventos nuevos
// arriba sin recargar.
export function useHistorial(tipo, id, tiposEvento, filtrosGlobal) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const cursorRef = useRef(null)
  const tiposKey = tiposEvento?.length ? tiposEvento.join(',') : ''
  const f = filtrosGlobal || {}
  const filtrosKey = JSON.stringify(f)

  const fetchPageEntidad = useCallback(async (reset) => {
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase.rpc('historial_entidad', {
      p_tipo: tipo,
      p_id: id || null,
      p_cursor: reset ? null : cursorRef.current,
      p_limit: PAGE_SIZE,
      p_tipos_evento: tiposKey ? tiposKey.split(',') : null,
    })
    if (!error && data) {
      cursorRef.current = data.length ? data[data.length - 1].ts : cursorRef.current
      setHasMore(data.length === PAGE_SIZE)
      setItems((prev) => (reset ? data : [...prev, ...data]))
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, id, tiposKey])

  const fetchPageGlobal = useCallback(async (reset) => {
    setLoading(true)
    let query = supabase.from('eventos').select('*').order('ts', { ascending: false }).limit(PAGE_SIZE)
    if (!reset && cursorRef.current) query = query.lt('ts', cursorRef.current)
    if (f.usuario) query = query.eq('usuario', f.usuario)
    if (f.clienteId) query = query.eq('cliente_id', f.clienteId)
    if (f.tipoEvento) query = query.eq('tipo_evento', f.tipoEvento)
    if (f.desde) query = query.gte('fecha_ref', f.desde)
    if (f.hasta) query = query.lte('fecha_ref', f.hasta)
    if (f.q) query = query.ilike('descripcion', `%${f.q}%`)
    // unidad no es columna directa de `eventos` — filtra por unidad_id
    // embebido en datos.before/after (reservas/unidades).
    if (f.unidadId) query = query.or(`datos->after->>unidad_id.eq.${f.unidadId},datos->before->>unidad_id.eq.${f.unidadId},registro_id.eq.${f.unidadId}`)

    const { data, error } = await query
    if (!error && data) {
      cursorRef.current = data.length ? data[data.length - 1].ts : cursorRef.current
      setHasMore(data.length === PAGE_SIZE)
      setItems((prev) => (reset ? data : [...prev, ...data]))
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey])

  const fetchPage = tipo === 'global' ? fetchPageGlobal : fetchPageEntidad

  useEffect(() => {
    cursorRef.current = null
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, id, tiposKey, filtrosKey])

  useEffect(() => {
    const matches = (row) => {
      if (tipo === 'global') return true
      const after = row.datos?.after || {}
      const before = row.datos?.before || {}
      if (tipo === 'cliente') return row.registro_id === id || after.cliente_id === id || before.cliente_id === id
      if (tipo === 'reserva') return row.registro_id === id || after.reserva_id === id || before.reserva_id === id
      if (tipo === 'unidad') return row.registro_id === id || after.unidad_id === id || before.unidad_id === id
      return false
    }
    const channel = supabase
      .channel(`historial-${tipo}-${id || 'global'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos' }, (payload) => {
        if (matches(payload.new)) setItems((prev) => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tipo, id])

  return { items, loading, hasMore, loadMore: () => fetchPage(false) }
}

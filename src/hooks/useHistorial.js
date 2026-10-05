import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

// Hook del Historial unificado (ítem 2, oct 2026). Para tipo='global' no
// hace fetch propio — se alimenta de `eventos` ya vivo en DataProvider (ver
// Actividad.jsx), que ya tiene su propia suscripción Realtime a la tabla
// completa. Para 'cliente'/'reserva'/'unidad' pagina contra la RPC
// historial_entidad (resuelve los joins comprobante→pago→reserva→unidad
// server-side) y abre un canal Realtime propio, acotado por id, para que un
// evento nuevo aparezca sin recargar.
export function useHistorial(tipo, id, tiposEvento) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(tipo !== 'global')
  const [hasMore, setHasMore] = useState(true)
  const cursorRef = useRef(null)
  const tiposKey = tiposEvento?.length ? tiposEvento.join(',') : ''

  const fetchPage = useCallback(async (reset) => {
    if (tipo === 'global' || (tipo !== 'global' && !id)) return
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

  useEffect(() => {
    if (tipo === 'global') return
    cursorRef.current = null
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, id, tiposKey])

  useEffect(() => {
    if (tipo === 'global' || !id) return
    const matches = (row) => {
      const after = row.datos?.after || {}
      const before = row.datos?.before || {}
      if (tipo === 'cliente') return row.registro_id === id || after.cliente_id === id || before.cliente_id === id
      if (tipo === 'reserva') return row.registro_id === id || after.reserva_id === id || before.reserva_id === id
      if (tipo === 'unidad') return row.registro_id === id || after.unidad_id === id || before.unidad_id === id
      return false
    }
    const channel = supabase
      .channel(`historial-${tipo}-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos' }, (payload) => {
        if (matches(payload.new)) setItems((prev) => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tipo, id])

  return { items, loading, hasMore, loadMore: () => fetchPage(false) }
}

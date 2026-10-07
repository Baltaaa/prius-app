import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isFeatureEnabled } from '../lib/features'

/**
 * "Recientes" (Tarea 6, feat-4, oct 2026) — últimos clientes/reservas que
 * abrió el usuario, por usuario y entre dispositivos. Tabla
 * `vistas_recientes` (usuario, entidad_tipo, entidad_id, visto_at único
 * por usuario+entidad — upsert sube el visto_at en vez de duplicar fila).
 * Sin localStorage a propósito, ver CLAUDE.md.
 */
export function registrarVisto(entidadTipo, entidadId) {
  if (!isFeatureEnabled('feat-4-recientes-home') || !entidadId) return
  supabase.auth.getUser().then(({ data }) => {
    const usuario = data?.user?.id
    if (!usuario) return
    supabase.from('vistas_recientes').upsert(
      { usuario, entidad_tipo: entidadTipo, entidad_id: entidadId, visto_at: new Date().toISOString() },
      { onConflict: 'usuario,entidad_tipo,entidad_id' },
    )
  })
}

export function useRecientes(limite = 5) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('vistas_recientes')
      .select('entidad_tipo, entidad_id, visto_at')
      .order('visto_at', { ascending: false })
      .limit(limite)
    if (error || !data) { setLoading(false); return }

    const clienteIds = data.filter((r) => r.entidad_tipo === 'cliente').map((r) => r.entidad_id)
    const reservaIds = data.filter((r) => r.entidad_tipo === 'reserva').map((r) => r.entidad_id)
    const [{ data: clientesData }, { data: reservasData }] = await Promise.all([
      clienteIds.length ? supabase.from('clientes').select('id, nombre').in('id', clienteIds) : Promise.resolve({ data: [] }),
      reservaIds.length
        ? supabase.from('reservas').select('id, cliente_id, tipo_alquiler, clientes!reservas_cliente_id_fkey(nombre), unidades(tipo, numero)').in('id', reservaIds)
        : Promise.resolve({ data: [] }),
    ])
    const clientesPorId = Object.fromEntries((clientesData || []).map((c) => [c.id, c]))
    const reservasPorId = Object.fromEntries((reservasData || []).map((r) => [r.id, r]))

    setItems(data.map((r) => ({
      tipo: r.entidad_tipo,
      id: r.entidad_id,
      visto_at: r.visto_at,
      cliente: r.entidad_tipo === 'cliente' ? clientesPorId[r.entidad_id] : null,
      reserva: r.entidad_tipo === 'reserva' ? reservasPorId[r.entidad_id] : null,
    })).filter((r) => r.cliente || r.reserva))
    setLoading(false)
  }, [limite])

  useEffect(() => { cargar() }, [cargar])

  return { items, loading }
}

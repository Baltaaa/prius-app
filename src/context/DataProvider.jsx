import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

/*
  Fuente única de datos del CRM.

  Antes cada hook (useReservas / useClientes / useCaja) tenía su propio
  useState + useEffect + fetch. Como useNotifications usa useReservas + useCaja,
  y useNotifications se monta en TopBar y en Sidebar, cada navegación disparaba
  ~7 requests (×2 con React.StrictMode en dev) y mantenía 3 copias del mismo
  array en memoria.

  Ahora: un fetch por tabla, un estado compartido, y todas las pantallas leen
  del mismo lugar. Suscripción Realtime para "single write, multiple reactive reads".
*/

const RESERVA_SELECT = `
  *,
  clientes (id, nombre, telefono, cuit, mail),
  unidades (id, numero, tipo, zona)
`

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [reservas, setReservas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [clientes, setClientes] = useState([])
  const [cajaHoy, setCajaHoy] = useState(null)
  const [historialCajas, setHistorialCajas] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // ---- Fetchers acotados (para realtime y refetch selectivo) ----

  const fetchReservas = useCallback(async () => {
    const { data, error } = await supabase
      .from('reservas')
      .select(RESERVA_SELECT)
      .order('created_at', { ascending: false })
    if (error) return
    setReservas(data || [])
  }, [])

  const fetchUnidades = useCallback(async () => {
    const { data } = await supabase.from('unidades').select('*').order('numero', { ascending: true })
    setUnidades(data || [])
  }, [])

  const fetchClientes = useCallback(async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre', { ascending: true })
    setClientes(data || [])
  }, [])

  const fetchCaja = useCallback(async () => {
    const { data: caja } = await supabase
      .from('caja_diaria').select('*').eq('fecha', todayStr).maybeSingle()
    setCajaHoy(caja || null)

    if (caja) {
      const { data: g } = await supabase.from('gastos_caja').select('*').eq('caja_id', caja.id)
      setGastos(g || [])
    } else {
      setGastos([])
    }

    const { data: hist } = await supabase
      .from('caja_diaria').select('*').order('fecha', { ascending: false }).limit(30)
    setHistorialCajas(hist || [])
  }, [todayStr])

  const refetchAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchUnidades(), fetchReservas(), fetchClientes(), fetchCaja()])
      setError(null)
    } catch (err) {
      console.error('Error cargando datos del CRM:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchUnidades, fetchReservas, fetchClientes, fetchCaja])

  useEffect(() => { refetchAll() }, [refetchAll])

  // ---- Realtime: un write en la DB -> refetch acotado de la tabla afectada ----
  const debounceRef = useRef({})
  const debouncedRefetch = useCallback((key, fn) => {
    clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(fn, 200)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('crm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' },
        () => debouncedRefetch('reservas', fetchReservas))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' },
        () => debouncedRefetch('unidades', fetchUnidades))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' },
        () => debouncedRefetch('clientes', fetchClientes))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_diaria' },
        () => debouncedRefetch('caja', fetchCaja))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos_caja' },
        () => debouncedRefetch('caja', fetchCaja))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [debouncedRefetch, fetchReservas, fetchUnidades, fetchClientes, fetchCaja])

  // ---- Mutaciones (optimistas; realtime concilia el resto) ----

  const createReserva = useCallback(async (reserva) => {
    const { data, error } = await supabase.from('reservas').insert([reserva]).select(RESERVA_SELECT)
    if (error) throw error
    await supabase.from('unidades').update({ estado: 'reservada' }).eq('id', reserva.unidad_id)
    setReservas((prev) => [data[0], ...prev])
    setUnidades((prev) => prev.map((u) => (u.id === reserva.unidad_id ? { ...u, estado: 'reservada' } : u)))
    return data[0]
  }, [])

  const updateReserva = useCallback(async (id, updates) => {
    const { clientes: _c, unidades: _u, ...clean } = updates
    const { data, error } = await supabase.from('reservas').update(clean).eq('id', id).select(RESERVA_SELECT)
    if (error) throw error
    setReservas((prev) => prev.map((r) => (r.id === id ? data[0] : r)))
    return data[0]
  }, [])

  const deleteReserva = useCallback(async (id, unidadId) => {
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) throw error
    if (unidadId) {
      await supabase.from('unidades').update({ estado: 'libre' }).eq('id', unidadId)
      setUnidades((prev) => prev.map((u) => (u.id === unidadId ? { ...u, estado: 'libre' } : u)))
    }
    setReservas((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const createCliente = useCallback(async (cliente) => {
    const { data, error } = await supabase.from('clientes').insert([cliente]).select()
    if (error) throw error
    setClientes((prev) => [...prev, data[0]].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return data[0]
  }, [])

  const updateCliente = useCallback(async (id, updates) => {
    const { data, error } = await supabase.from('clientes').update(updates).eq('id', id).select()
    if (error) throw error
    setClientes((prev) =>
      prev.map((c) => (c.id === id ? data[0] : c)).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return data[0]
  }, [])

  const deleteCliente = useCallback(async (id) => {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) throw error
    setClientes((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const iniciarCaja = useCallback(async () => {
    const newCaja = {
      fecha: todayStr, efectivo: 0, medio_pago_1: 0, medio_pago_2: 0,
      total_cobros: 0, total_gastos: 0, total_neto: 0, cerrada: false,
    }
    const { data, error } = await supabase.from('caja_diaria').insert([newCaja]).select()
    if (error) throw error
    setCajaHoy(data[0])
    setHistorialCajas((prev) => [data[0], ...prev])
    return data[0]
  }, [todayStr])

  const actualizarCajaValores = useCallback(async (updates) => {
    if (!cajaHoy) return
    const total_cobros =
      Number(updates.efectivo || 0) + Number(updates.medio_pago_1 || 0) + Number(updates.medio_pago_2 || 0)
    const finalUpdates = { ...updates, total_cobros, total_neto: total_cobros - Number(cajaHoy.total_gastos || 0) }
    const { data, error } = await supabase.from('caja_diaria').update(finalUpdates).eq('id', cajaHoy.id).select()
    if (error) throw error
    setCajaHoy(data[0])
    setHistorialCajas((prev) => prev.map((c) => (c.id === cajaHoy.id ? data[0] : c)))
    return data[0]
  }, [cajaHoy])

  const agregarGasto = useCallback(async (descripcion, monto) => {
    if (!cajaHoy) return
    const { data, error } = await supabase
      .from('gastos_caja').insert([{ caja_id: cajaHoy.id, descripcion, monto: Number(monto) }]).select()
    if (error) throw error
    const nuevoTotalGastos = Number(cajaHoy.total_gastos) + Number(monto)
    const { data: updated } = await supabase.from('caja_diaria').update({
      total_gastos: nuevoTotalGastos,
      total_neto: Number(cajaHoy.total_cobros) - nuevoTotalGastos,
    }).eq('id', cajaHoy.id).select()
    setGastos((prev) => [...prev, data[0]])
    setCajaHoy(updated[0])
    setHistorialCajas((prev) => prev.map((c) => (c.id === cajaHoy.id ? updated[0] : c)))
  }, [cajaHoy])

  const eliminarGasto = useCallback(async (gastoId, monto) => {
    if (!cajaHoy) return
    const { error } = await supabase.from('gastos_caja').delete().eq('id', gastoId)
    if (error) throw error
    const nuevoTotalGastos = Math.max(0, Number(cajaHoy.total_gastos) - Number(monto))
    const { data: updated } = await supabase.from('caja_diaria').update({
      total_gastos: nuevoTotalGastos,
      total_neto: Number(cajaHoy.total_cobros) - nuevoTotalGastos,
    }).eq('id', cajaHoy.id).select()
    setGastos((prev) => prev.filter((g) => g.id !== gastoId))
    setCajaHoy(updated[0])
    setHistorialCajas((prev) => prev.map((c) => (c.id === cajaHoy.id ? updated[0] : c)))
  }, [cajaHoy])

  const cerrarCaja = useCallback(async () => {
    if (!cajaHoy) return
    const { data, error } = await supabase.from('caja_diaria').update({ cerrada: true }).eq('id', cajaHoy.id).select()
    if (error) throw error
    setCajaHoy(data[0])
    setHistorialCajas((prev) => prev.map((c) => (c.id === cajaHoy.id ? data[0] : c)))
    return data[0]
  }, [cajaHoy])

  const value = useMemo(() => ({
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, loading, error,
    createReserva, updateReserva, deleteReserva,
    createCliente, updateCliente, deleteCliente,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja,
    refetchAll, fetchReservas, fetchClientes, fetchCaja,
  }), [
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, loading, error,
    createReserva, updateReserva, deleteReserva,
    createCliente, updateCliente, deleteCliente,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja,
    refetchAll, fetchReservas, fetchClientes, fetchCaja,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}

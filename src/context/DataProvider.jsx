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

// clientes!reservas_cliente_id_fkey: desambigua el embed — hay dos caminos
// posibles entre reservas y clientes (la FK directa reservas.cliente_id y la
// tabla puente reserva_clientes), PostgREST tira PGRST201 si no se especifica
// cuál. cliente_id sigue siendo el titular/responsable de la reserva.
// reserva_clientes trae además la lista completa de co-socios vinculados a
// esa unidad (titular incluido) — ver lib/reservas.js `coSocios()`.
const RESERVA_SELECT = `
  *,
  clientes!reservas_cliente_id_fkey (id, nombre, telefono, cuit, mail),
  unidades (id, numero, tipo, zona),
  reserva_clientes (cliente_id, clientes (id, nombre))
`

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [reservas, setReservas] = useState([])
  const [unidades, setUnidades] = useState([])
  const [clientes, setClientes] = useState([])
  const [cajaHoy, setCajaHoy] = useState(null)
  const [historialCajas, setHistorialCajas] = useState([])
  const [gastos, setGastos] = useState([])
  const [todosGastos, setTodosGastos] = useState([])
  const [ingresosCaja, setIngresosCaja] = useState([])
  const [eventos, setEventos] = useState([])
  const [leads, setLeads] = useState([])
  const [pagos, setPagos] = useState([])
  const [temporadas, setTemporadas] = useState([])
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

  // Historial de Caja Diaria (navegación por fecha): egresos e ingresos de
  // TODOS los días, no solo el de hoy. `gastos` (arriba) sigue siendo solo
  // los de `cajaHoy`, para no tocar el flujo de "Registrar Egreso" existente.
  const fetchTodosGastos = useCallback(async () => {
    const { data } = await supabase.from('gastos_caja').select('*').order('created_at', { ascending: false })
    setTodosGastos(data || [])
  }, [])

  // Ingresos itemizados de caja (Fase 2, cruce con pagos): cada pago en
  // efectivo/tarjeta/transferencia genera acá su fila vía el trigger
  // fn_pago_crea_ingreso_caja — nada se carga a mano desde el front.
  const fetchIngresosCaja = useCallback(async () => {
    const { data } = await supabase.from('ingresos_caja').select('*').order('created_at', { ascending: false })
    setIngresosCaja(data || [])
  }, [])

  // Línea de tiempo del CRM: log de eventos (tabla `eventos`, escrita por triggers).
  const fetchEventos = useCallback(async () => {
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .order('fecha_ref', { ascending: false })
      .order('ts', { ascending: false })
      .limit(300)
    setEventos(data || [])
  }, [])

  // Bandeja de leads del CRM: tabla `leads`, alimentada por el form de la landing
  // (beachFlow) vía webhook n8n. Reemplaza como canal de lectura a la
  // notificación automática por CallMeBot al WhatsApp administrativo.
  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    setLeads(data || [])
  }, [])

  // Motor de pagos (Fase 2): historial crudo de `pagos`. El saldo/estado_pago
  // de la reserva ya lo recalcula el trigger fn_pago_actualiza_saldo — este
  // fetch es solo para listar el historial (Clientes, Reservas, Comprobantes).
  const fetchPagos = useCallback(async () => {
    const { data } = await supabase
      .from('pagos')
      .select('*')
      .order('created_at', { ascending: false })
    setPagos(data || [])
  }, [])

  // Temporadas (Frente 2): entidad real en vez del string suelto
  // reservas.temporada. Alta de reserva/caja nueva toma sola la que tenga
  // estado='activa' (trigger fn_reserva_asigna_temporada / fn_caja_asigna_temporada,
  // no se elige a mano en la UI) — este fetch es solo para leerla y mostrarla.
  const fetchTemporadas = useCallback(async () => {
    const { data } = await supabase.from('temporadas').select('*').order('fecha_inicio', { ascending: false })
    setTemporadas(data || [])
  }, [])

  const refetchAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchUnidades(), fetchReservas(), fetchClientes(), fetchCaja(), fetchEventos(), fetchLeads(), fetchPagos(),
        fetchTodosGastos(), fetchIngresosCaja(), fetchTemporadas(),
      ])
      setError(null)
    } catch (err) {
      console.error('Error cargando datos del CRM:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchUnidades, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos, fetchTodosGastos, fetchIngresosCaja, fetchTemporadas])

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
        () => { debouncedRefetch('caja', fetchCaja); debouncedRefetch('todosGastos', fetchTodosGastos) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos' },
        () => debouncedRefetch('eventos', fetchEventos))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' },
        () => debouncedRefetch('pagos', fetchPagos))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingresos_caja' },
        () => { debouncedRefetch('ingresosCaja', fetchIngresosCaja); debouncedRefetch('caja', fetchCaja) })
      .subscribe()

    // `leads` va en su propio canal: un binding postgres_changes sobre una tabla
    // ausente de la publication `supabase_realtime` (hoy: clientes, caja_diaria,
    // gastos_caja) anula TODOS los eventos del canal que lo contiene. Aislar
    // leads garantiza que la bandeja reciba INSERT/UPDATE en vivo aunque el
    // canal principal esté degradado.
    const leadsChannel = supabase
      .channel('crm-leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' },
        () => debouncedRefetch('leads', fetchLeads))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(leadsChannel)
    }
  }, [debouncedRefetch, fetchReservas, fetchUnidades, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos, fetchTodosGastos, fetchIngresosCaja])

  // ---- Mutaciones (optimistas; realtime concilia el resto) ----

  // El estado de la unidad NO se escribe desde el front: lo deriva el trigger
  // trg_reserva_actualiza_unidad segun la vigencia de la reserva, y Realtime
  // sobre `unidades` refresca la copia local.
  const createReserva = useCallback(async (reserva) => {
    const { data, error } = await supabase.from('reservas').insert([reserva]).select(RESERVA_SELECT)
    if (error) throw error
    setReservas((prev) => [data[0], ...prev])
    return data[0]
  }, [])

  const updateReserva = useCallback(async (id, updates) => {
    const { clientes: _c, unidades: _u, ...clean } = updates
    const { data, error } = await supabase.from('reservas').update(clean).eq('id', id).select(RESERVA_SELECT)
    if (error) throw error
    setReservas((prev) => prev.map((r) => (r.id === id ? data[0] : r)))
    return data[0]
  }, [])

  // Hard delete real: borra la fila de reservas y (via FK cascade en la DB,
  // pagos.reserva_id / ingresos_caja.*) sus pagos e ingresos de caja
  // asociados, todo en la misma transacción implícita del DELETE. Nunca toca
  // clientes (reservas.cliente_id es ON DELETE SET NULL).
  const deleteReserva = useCallback(async (id) => {
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) throw error
    // El trigger libera la unidad al borrarse la reserva; Realtime concilia.
    setReservas((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // Soft delete: no borra la fila ni sus pagos (queda para caja/reportes/
  // histórico) — solo pasa estado a 'cancelada'. Libera la unidad (trigger
  // trg_reserva_actualiza_unidad, que solo cuenta reservas vigentes) y el
  // rango de fechas del exclusion constraint de no-solapamiento (que también
  // filtra por estado='activa').
  const cancelarReserva = useCallback(async (id) => {
    const { data, error } = await supabase.from('reservas').update({ estado: 'cancelada' }).eq('id', id).select(RESERVA_SELECT)
    if (error) throw error
    setReservas((prev) => prev.map((r) => (r.id === id ? data[0] : r)))
    return data[0]
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

  // unidades.id <- reservas.unidad_id es ON DELETE SET NULL: borrar una
  // unidad no borra sus reservas históricas, solo les saca la referencia.
  const deleteUnidad = useCallback(async (id) => {
    const { error } = await supabase.from('unidades').delete().eq('id', id)
    if (error) throw error
    setUnidades((prev) => prev.filter((u) => u.id !== id))
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

  // total_neto ya no se calcula a mano acá: lo recalcula siempre
  // trg_caja_calcula_totales (BEFORE UPDATE en caja_diaria) a partir de
  // saldo_apertura + total_cobros - total_gastos — un solo lugar para esa
  // cuenta (Task 3), en vez de repetirla en cada mutación del front.
  const actualizarCajaValores = useCallback(async (updates) => {
    if (!cajaHoy) return
    const total_cobros =
      Number(updates.efectivo || 0) + Number(updates.medio_pago_1 || 0) + Number(updates.medio_pago_2 || 0)
    const { data, error } = await supabase.from('caja_diaria').update({ ...updates, total_cobros }).eq('id', cajaHoy.id).select()
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
    const { data: updated } = await supabase.from('caja_diaria')
      .update({ total_gastos: nuevoTotalGastos }).eq('id', cajaHoy.id).select()
    setGastos((prev) => [...prev, data[0]])
    setTodosGastos((prev) => [data[0], ...prev])
    setCajaHoy(updated[0])
    setHistorialCajas((prev) => prev.map((c) => (c.id === cajaHoy.id ? updated[0] : c)))
  }, [cajaHoy])

  const eliminarGasto = useCallback(async (gastoId, monto) => {
    if (!cajaHoy) return
    const { error } = await supabase.from('gastos_caja').delete().eq('id', gastoId)
    if (error) throw error
    const nuevoTotalGastos = Math.max(0, Number(cajaHoy.total_gastos) - Number(monto))
    const { data: updated } = await supabase.from('caja_diaria')
      .update({ total_gastos: nuevoTotalGastos }).eq('id', cajaHoy.id).select()
    setGastos((prev) => prev.filter((g) => g.id !== gastoId))
    setTodosGastos((prev) => prev.filter((g) => g.id !== gastoId))
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

  // Alta de pago (Fase 2, motor de pagos): un solo punto de escritura,
  // reutilizado por Clientes y Reservas vía usePagos(). El trigger Postgres
  // fn_pago_actualiza_saldo ya recalcula reservas.saldo/estado_pago; acá
  // forzamos además un refetch de reservas para no depender del round-trip
  // de Realtime en la misma pestaña que hizo la escritura.
  const createPago = useCallback(async (pago) => {
    const { data, error } = await supabase.from('pagos').insert([pago]).select()
    if (error) throw error
    setPagos((prev) => [data[0], ...prev])
    await fetchReservas()
    return data[0]
  }, [fetchReservas])

  // Update reactivo de un lead (estado: nuevo -> contactado -> descartado, o
  // notas_crm). Optimista; Realtime sobre `leads` concilia el resto.
  const updateLead = useCallback(async (id, updates) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select()
    if (error) { fetchLeads(); throw error }
    setLeads((prev) => prev.map((l) => (l.id === id ? data[0] : l)))
    return data[0]
  }, [fetchLeads])

  const temporadaActiva = useMemo(() => temporadas.find((t) => t.estado === 'activa') || null, [temporadas])

  const value = useMemo(() => ({
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja,
    eventos, leads, pagos, temporadas, temporadaActiva, loading, error,
    createReserva, updateReserva, deleteReserva, cancelarReserva,
    createCliente, updateCliente, deleteCliente, deleteUnidad,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja,
    updateLead, createPago,
    refetchAll, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos,
    fetchTodosGastos, fetchIngresosCaja, fetchTemporadas,
  }), [
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja,
    eventos, leads, pagos, temporadas, temporadaActiva, loading, error,
    createReserva, updateReserva, deleteReserva, cancelarReserva,
    createCliente, updateCliente, deleteCliente, deleteUnidad,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja,
    updateLead, createPago,
    refetchAll, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos,
    fetchTodosGastos, fetchIngresosCaja, fetchTemporadas,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}

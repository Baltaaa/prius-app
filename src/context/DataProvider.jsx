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
  clientes!reservas_cliente_id_fkey (id, nombre, apellido, telefono, cuit, mail, condicion_iva, razon_social),
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

  // Ingresos itemizados de caja (Fase 3): antes venían de la tabla puente
  // `ingresos_caja` (deprecada, ver migración caja_dinero_fase3); ahora se
  // arman directo desde `pagos.caja_id`, que la RPC registrar_pago asigna
  // sola. Misma forma de fila que antes para no tocar el render de Caja.jsx.
  const fetchIngresosCaja = useCallback(async () => {
    const { data } = await supabase
      .from('pagos')
      .select('id, caja_id, reserva_id, cliente_id, monto, medio, concepto, fecha_hora, estado')
      .not('caja_id', 'is', null)
      .eq('estado', 'vigente')
      .order('fecha_hora', { ascending: false })
    setIngresosCaja((data || []).map((p) => ({
      id: p.id, caja_id: p.caja_id, pago_id: p.id, reserva_id: p.reserva_id, cliente_id: p.cliente_id,
      monto: p.monto, medio: p.medio, es_efectivo: p.medio === 'efectivo',
      concepto: p.concepto || 'Pago', created_at: p.fecha_hora,
    })))
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
      .select('*, comprobantes(id, tipo, punto_venta, numero, fecha, estado)')
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
        () => { debouncedRefetch('pagos', fetchPagos); debouncedRefetch('ingresosCaja', fetchIngresosCaja); debouncedRefetch('caja', fetchCaja) })
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

  // Caja Fase 3 (dinero): el CRUD directo sobre caja_diaria/gastos_caja/pagos
  // está revocado a nivel RLS — todo pasa por las funciones RPC de Postgres
  // (abrir_caja/registrar_gasto/anular_gasto/cerrar_caja/registrar_pago/
  // anular_pago/completar_comprobante), que validan y devuelven la fila ya
  // actualizada. El refetch puntual evita depender del round-trip de
  // Realtime en la misma pestaña que hizo la escritura.
  const iniciarCaja = useCallback(async (montoInicial) => {
    const { data, error } = await supabase.rpc('abrir_caja', { p_monto_inicial: Number(montoInicial) || 0 })
    if (error) throw error
    setCajaHoy(data)
    setHistorialCajas((prev) => [data, ...prev.filter((c) => c.id !== data.id)])
    return data
  }, [])

  const registrarGasto = useCallback(async ({ concepto, categoria, medioPago, monto, proveedor, comprobanteProveedor }) => {
    const { data, error } = await supabase.rpc('registrar_gasto', {
      p_concepto: concepto, p_categoria: categoria, p_medio_pago: medioPago, p_monto: Number(monto),
      p_proveedor: proveedor || null, p_comprobante_proveedor: comprobanteProveedor || null,
    })
    if (error) throw error
    setTodosGastos((prev) => [data, ...prev])
    if (cajaHoy) setGastos((prev) => [...prev, data])
    await fetchCaja()
    return data
  }, [cajaHoy, fetchCaja])

  const anularGasto = useCallback(async (gastoId, motivo) => {
    const { data, error } = await supabase.rpc('anular_gasto', { p_gasto_id: gastoId, p_motivo: motivo })
    if (error) throw error
    setTodosGastos((prev) => prev.map((g) => (g.id === gastoId ? data : g)))
    setGastos((prev) => prev.map((g) => (g.id === gastoId ? data : g)))
    await fetchCaja()
    return data
  }, [fetchCaja])

  // `cajaId` explícito: Caja.jsx deja navegar a cualquier fecha y cerrar una
  // caja que quedó abierta de un día anterior (no se cierra sola a medianoche
  // — hay que cerrarla a mano). Antes esto asumía `cajaHoy.id` sin importar
  // qué caja estaba realmente seleccionada: si `cajaHoy` era null (hoy
  // todavía no se abrió, que es exactamente el caso de una caja de ayer sin
  // cerrar) la función hacía `return` en silencio — el stepper de cierre
  // completaba sus 3 pasos y cerraba el modal como si hubiera funcionado,
  // pero no se mandaba ningún RPC y la caja seguía abierta en la base.
  const cerrarCaja = useCallback(async (cajaId, efectivoContado, datosZ, observaciones) => {
    if (!cajaId) return
    const { data, error } = await supabase.rpc('cerrar_caja', {
      p_caja_id: cajaId, p_efectivo_contado: Number(efectivoContado) || 0,
      p_datos_z: datosZ || null, p_observaciones: observaciones || null,
    })
    if (error) throw error
    if (cajaHoy?.id === cajaId) setCajaHoy(data)
    setHistorialCajas((prev) => prev.map((c) => (c.id === cajaId ? data : c)))
    return data
  }, [cajaHoy])

  const reabrirCaja = useCallback(async (cajaId, motivo) => {
    const { data, error } = await supabase.rpc('reabrir_caja', { p_caja_id: cajaId, p_motivo: motivo })
    if (error) throw error
    await fetchCaja()
    return data
  }, [fetchCaja])

  // Alta de pago (Fase 3, RPC-only): un solo punto de escritura, reutilizado
  // por RegistrarPago (Clientes/Reservas/Plano). registrar_pago valida saldo,
  // bonificada y caja abierta, y crea el comprobante si vino incluido.
  // `fecha` (opcional, default hoy en la RPC): si es anterior a
  // fn_caja_inicio() el pago queda histórico — sin caja_id, no exige caja
  // abierta y no aparece en ningún resumen de caja (ver lib/pagos.js).
  const registrarPago = useCallback(async ({
    clienteId, monto, medio, tipoPago, concepto, reservaId, referencia, comprobante, permitirExcedente, fecha,
  }) => {
    const { data, error } = await supabase.rpc('registrar_pago', {
      p_cliente_id: clienteId, p_monto: Number(monto), p_medio: medio, p_tipo_pago: tipoPago,
      p_concepto: concepto, p_reserva_id: reservaId || null, p_referencia: referencia || null,
      p_comprobante: comprobante || null, p_permitir_excedente: !!permitirExcedente,
      p_fecha: fecha || undefined,
    })
    if (error) throw error
    // fetchPagos (no un merge optimista con `data`) para que el pago nuevo
    // ya traiga el comprobante embebido (`data` del RPC es la fila cruda de
    // `pagos`, sin el join a `comprobantes` que usa el detalle).
    await fetchPagos()
    await fetchReservas()
    await fetchCaja()
    return data
  }, [fetchPagos, fetchReservas, fetchCaja])

  const anularPago = useCallback(async (pagoId, motivo) => {
    const { data, error } = await supabase.rpc('anular_pago', { p_pago_id: pagoId, p_motivo: motivo })
    if (error) throw error
    await fetchPagos()
    await fetchReservas()
    await fetchCaja()
    return data
  }, [fetchPagos, fetchReservas, fetchCaja])

  const completarComprobante = useCallback(async (pagoId, comprobante) => {
    const { data, error } = await supabase.rpc('completar_comprobante', { p_pago_id: pagoId, p_comprobante: comprobante })
    if (error) throw error
    await fetchPagos()
    return data
  }, [fetchPagos])

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
    iniciarCaja, registrarGasto, anularGasto, cerrarCaja, reabrirCaja,
    updateLead, registrarPago, anularPago, completarComprobante,
    refetchAll, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos,
    fetchTodosGastos, fetchIngresosCaja, fetchTemporadas,
  }), [
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja,
    eventos, leads, pagos, temporadas, temporadaActiva, loading, error,
    createReserva, updateReserva, deleteReserva, cancelarReserva,
    createCliente, updateCliente, deleteCliente, deleteUnidad,
    iniciarCaja, registrarGasto, anularGasto, cerrarCaja, reabrirCaja,
    updateLead, registrarPago, anularPago, completarComprobante,
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

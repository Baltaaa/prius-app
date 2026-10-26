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
  reserva_clientes (cliente_id, clientes (id, nombre)),
  reserva_grupos (id, cliente_id, temporada, precio_total, notas)
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
  const [codigosReserva, setCodigosReserva] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Estado real de Realtime (no inventado): el chip "Operativo" del shell
  // (TopBar, oct 2026) lo lee de acá — true solo si el canal principal está
  // efectivamente SUBSCRIBED, no un flag siempre-true.
  const [realtimeConectado, setRealtimeConectado] = useState(false)

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
    // comprobantes!comprobantes_pago_id_fkey: un pago puede tener VARIOS
    // comprobantes (oct 2026, caso D'Agostino con 5) — se embebe como array
    // vía ese FK, no el singular `comprobantes(...)` de antes (que seguía
    // pagos.comprobante_id, pensado solo para el flujo en vivo de un
    // comprobante a la vez). PostgREST exige desambiguar: hay dos caminos
    // posibles entre pagos y comprobantes.
    // clientes(nombre) (ítem 3, 25/10/2026): quién pagó cada cuota — en una
    // reserva con cosocios, titular y cosocios pueden pagar cuotas distintas
    // de la misma reserva, así que el comprobante/monto solo no alcanza para
    // distinguir de un vistazo quién cargó cada una (PagosGrid.jsx,
    // ReservaDetalleContent.jsx).
    const { data } = await supabase
      .from('pagos')
      .select('*, comprobantes!comprobantes_pago_id_fkey(id, tipo, punto_venta, numero, fecha, estado, monto_total), clientes(nombre)')
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

  // Fase 3 (Recepción): códigos PRIUS-XXXXXX que agrupan las 1-2 unidades de
  // una reserva web (ver CLAUDE.md "Sistema de reservas públicas"). Mismo
  // patrón de carga en memoria que el resto de las tablas.
  const fetchCodigosReserva = useCallback(async () => {
    const { data } = await supabase
      .from('codigos_reserva')
      .select('*')
      .order('created_at', { ascending: false })
    setCodigosReserva(data || [])
  }, [])

  const refetchAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchUnidades(), fetchReservas(), fetchClientes(), fetchCaja(), fetchEventos(), fetchLeads(), fetchPagos(),
        fetchTodosGastos(), fetchIngresosCaja(), fetchTemporadas(), fetchCodigosReserva(),
      ])
      setError(null)
    } catch (err) {
      console.error('Error cargando datos del CRM:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchUnidades, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos, fetchTodosGastos, fetchIngresosCaja, fetchTemporadas, fetchCodigosReserva])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'codigos_reserva' },
        () => debouncedRefetch('codigosReserva', fetchCodigosReserva))
      .subscribe((status) => setRealtimeConectado(status === 'SUBSCRIBED'))

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
  }, [debouncedRefetch, fetchReservas, fetchUnidades, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos, fetchTodosGastos, fetchIngresosCaja, fetchCodigosReserva])

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

  // Item 3 (oct 2026): alta de reserva + primer pago/comprobante en una
  // sola transacción (fn_crear_reserva_con_pago) — si el pago falla, la
  // reserva no queda creada. `pago` es opcional (null = "Cargar más
  // tarde" o unidad bonificada, mismo comportamiento de siempre). El RPC
  // devuelve la reserva cruda (sin los joins de RESERVA_SELECT) — se
  // refetchea en vez de mergear a mano, mismo patrón que registrarPago.
  const crearReservaConPago = useCallback(async ({ reserva, pago }) => {
    const { data, error } = await supabase.rpc('fn_crear_reserva_con_pago', {
      p_reserva: reserva, p_pago: pago || null,
    })
    if (error) throw error
    await fetchReservas()
    if (pago) {
      await fetchPagos()
      await fetchCaja()
    }
    return data
  }, [fetchReservas, fetchPagos, fetchCaja])

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

  // Agrupa varias reservas del MISMO cliente bajo un precio total único (oct
  // 2026, caso Ana Lescano: 3 períodos, un solo pactado). Crea la fila de
  // reserva_grupos y apunta `grupo_id` en cada reserva — dos escrituras, no
  // atómicas a nivel DB, mismo patrón ya usado en Clientes.jsx para alta de
  // cliente + reserva de temporada. Si la segunda falla, el grupo queda
  // creado sin reservas asociadas (huérfano, visible solo por auditoría
  // manual) — aceptable para una acción administrativa de baja frecuencia.
  const crearGrupoReservas = useCallback(async ({ clienteId, temporada, precioTotal, notas, reservaIds }) => {
    const { data: grupo, error: errGrupo } = await supabase
      .from('reserva_grupos')
      .insert([{ cliente_id: clienteId, temporada: temporada || null, precio_total: precioTotal, notas: notas || null }])
      .select()
    if (errGrupo) throw errGrupo
    const grupoId = grupo[0].id
    const { error: errReservas } = await supabase.from('reservas').update({ grupo_id: grupoId }).in('id', reservaIds)
    if (errReservas) throw errReservas
    await fetchReservas()
    return grupo[0]
  }, [fetchReservas])

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

  // Antes de borrar: trigger trg_cliente_libera_unidad_al_borrar (oct 2026)
  // cancela cualquier reserva activa de la que este cliente sea titular
  // (estado='cancelada', libera la unidad vía el mismo trigger de siempre)
  // — si no, reservas.cliente_id quedaba en null por el ON DELETE SET NULL
  // pero la reserva seguía 'activa', ocupando la unidad para siempre sin
  // cliente. Pagos reales (pagos.cliente_id es NO ACTION) siguen bloqueando
  // el borrado — eso es a propósito, nunca se pierde historial de dinero.
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

  // Ítem 3 (25/10/2026): alta/baja de cosocio — tabla puente simple
  // (reserva_clientes), RLS ya permite insert/delete a cualquier usuario
  // activo (ver policies), sin RPC propia. `quitarCosocio` no valida acá si
  // tiene pagos — ese guard vive en la UI (ReservaDetalleContent), que ya
  // tiene los pagos cargados y puede avisar sin un viaje extra al server;
  // de todos modos los pagos de ese cliente NO se borran ni se desvinculan
  // al sacarlo de reserva_clientes (son filas independientes en `pagos`).
  // fetchReservas() porque reserva_clientes viene embebido en el select de
  // reservas (RESERVA_SELECT) — no hay una tabla local propia que parchear.
  const agregarCosocio = useCallback(async (reservaId, clienteId) => {
    const { error } = await supabase.from('reserva_clientes').insert({ reserva_id: reservaId, cliente_id: clienteId })
    if (error) throw error
    await fetchReservas()
  }, [fetchReservas])

  const quitarCosocio = useCallback(async (reservaId, clienteId) => {
    const { error } = await supabase.from('reserva_clientes').delete().eq('reserva_id', reservaId).eq('cliente_id', clienteId)
    if (error) throw error
    await fetchReservas()
  }, [fetchReservas])

  // Caja Fase 3 (dinero): el CRUD directo sobre caja_diaria/gastos_caja/pagos
  // está revocado a nivel RLS — todo pasa por las funciones RPC de Postgres
  // (abrir_caja/registrar_gasto/anular_gasto/cerrar_caja/registrar_pago/
  // anular_pago/completar_comprobante), que validan y devuelven la fila ya
  // actualizada. El refetch puntual evita depender del round-trip de
  // Realtime en la misma pestaña que hizo la escritura.
  // Caja diaria (oct 2026): siempre arranca en 0, no se pregunta monto
  // inicial — la caja se auto-crea sola en el primer cobro/gasto del día.
  const iniciarCaja = useCallback(async () => {
    const { data, error } = await supabase.rpc('abrir_caja')
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
  // Ítem 1 (25/10/2026): cerrarCaja ahora acepta `contadoPorMedio` ({medio:
  // monto}, incluye efectivo) — el arqueo integra todos los medios, no solo
  // efectivo. p_efectivo_contado se sigue mandando igual que siempre (la
  // RPC lo usa como fuente única de las columnas legacy efectivo_esperado/
  // efectivo_contado/diferencia); contadoPorMedio es aditivo.
  const cerrarCaja = useCallback(async (cajaId, efectivoContado, datosZ, observaciones, contadoPorMedio) => {
    if (!cajaId) return
    const { data, error } = await supabase.rpc('cerrar_caja', {
      p_caja_id: cajaId, p_efectivo_contado: Number(efectivoContado) || 0,
      p_datos_z: datosZ || null, p_observaciones: observaciones || null,
      p_contado_por_medio: contadoPorMedio || null,
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

  // Ítem 4 (oct 2026): cargar/corregir monto y fecha de un comprobante ya
  // existente. El RPC valida rol server-side (solo superadmin) y no toca
  // caja_diaria ni pagos.monto — queda auditado solo en `eventos`, vía el
  // trigger de fn_log_evento sobre `comprobantes`.
  // Oct 2026 (bandeja de pendientes, pago_sin_monto): carga el monto real
  // de un pago migrado que llegó con monto null — solo cuando hoy es null,
  // el RPC lo valida server-side. Dispara los mismos triggers que cualquier
  // UPDATE de pagos (recalcula saldo de la reserva, resuelve la pendiente).
  const editarMontoPago = useCallback(async (pagoId, monto) => {
    const { data, error } = await supabase.rpc('editar_monto_pago', { p_pago_id: pagoId, p_monto: Number(monto) })
    if (error) throw error
    await fetchPagos()
    await fetchReservas()
    return data
  }, [fetchPagos, fetchReservas])

  // Oct 2026 (modal "Pago N.º X" → Cargar monto con datos completos):
  // UPDATE sobre un pago ya existente (monto, medio, tipo, fecha original
  // del recibo y comprobante asociado), nunca INSERT — reemplaza el flujo
  // angosto de `editarMontoPago` (solo monto) para el caso de recibos sin
  // monto. `fetchCaja`/`fetchIngresosCaja` porque la fecha elegida puede
  // imputar el movimiento a la caja de hoy (si no es histórica).
  const editarPagoCompleto = useCallback(async (pagoId, { monto, medio, tipoPago, fecha, comprobante }) => {
    const { data, error } = await supabase.rpc('fn_editar_pago_completo', {
      p_pago_id: pagoId, p_monto: Number(monto), p_medio: medio, p_tipo_pago: tipoPago,
      p_fecha: fecha, p_comprobante: comprobante,
    })
    if (error) throw error
    await fetchPagos()
    await fetchReservas()
    await fetchCaja()
    await fetchIngresosCaja()
    return data
  }, [fetchPagos, fetchReservas, fetchCaja, fetchIngresosCaja])

  const editarComprobante = useCallback(async (comprobanteId, monto, fecha, tipo) => {
    const { data, error } = await supabase.rpc('editar_comprobante', {
      p_comprobante_id: comprobanteId, p_monto: monto, p_fecha: fecha || null, p_tipo: tipo || null,
    })
    if (error) throw error
    await fetchPagos()
    return data
  }, [fetchPagos])

  // Ítem 2 (25/10/2026): revertir/cambiar a mano el estado_pago de una
  // reserva — solo superadmin, validado también server-side en la RPC. No
  // toca pagos/comprobantes, solo reservas.estado_pago* (ver migración
  // estado_pago_manual_override). fetchReservas() refleja el cambio de
  // inmediato en esta pestaña; Realtime (ya suscripto a `reservas`)
  // propaga a Plano/Clientes/Dashboard en cualquier otra pestaña abierta.
  const cambiarEstadoPagoManual = useCallback(async (reservaId, nuevoEstado, motivo) => {
    const { data, error } = await supabase.rpc('cambiar_estado_pago_manual', {
      p_reserva_id: reservaId, p_nuevo_estado: nuevoEstado, p_motivo: motivo,
    })
    if (error) throw error
    await fetchReservas()
    return data
  }, [fetchReservas])

  const revertirEstadoPagoAutomatico = useCallback(async (reservaId) => {
    const { data, error } = await supabase.rpc('revertir_estado_pago_automatico', { p_reserva_id: reservaId })
    if (error) throw error
    await fetchReservas()
    return data
  }, [fetchReservas])

  // Item 15 (testing oct 2026): registra la emisión de un comprobante
  // interno (ComprobanteDocumento.jsx) y devuelve su número correlativo
  // real (asignado en la base, nunca calculado en el front). El snapshot
  // queda guardado para que una reimpresión futura pueda usar los mismos
  // datos — hoy el front sigue recalculando en vivo para la vista previa,
  // pero el número y el registro de auditoría ya son reales.
  const emitirComprobante = useCallback(async ({ reservaId, pagoId, tipo, snapshot }) => {
    const { data, error } = await supabase.rpc('fn_emitir_comprobante', {
      p_reserva_id: reservaId, p_pago_id: pagoId || null, p_tipo: tipo, p_snapshot: snapshot,
    })
    if (error) throw error
    return data
  }, [])

  // Item 9 (testing oct 2026): corrige el monto de un pago YA verificado —
  // solo superadmin (validado en el RPC, no solo acá). Distinto de
  // editarMontoPago (arriba de esta sección), que es para cargar el monto
  // de un recibo migrado que todavía está en null.
  const editarMontoPagoVigente = useCallback(async (pagoId, monto) => {
    const { data, error } = await supabase.rpc('fn_editar_monto_pago_vigente', {
      p_pago_id: pagoId, p_monto: Number(monto),
    })
    if (error) throw error
    await fetchPagos()
    await fetchReservas()
    return data
  }, [fetchPagos, fetchReservas])

  // Update reactivo de un lead (estado: nuevo -> contactado -> descartado, o
  // notas_crm). Optimista; Realtime sobre `leads` concilia el resto.
  const updateLead = useCallback(async (id, updates) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select()
    if (error) { fetchLeads(); throw error }
    setLeads((prev) => prev.map((l) => (l.id === id ? data[0] : l)))
    return data[0]
  }, [fetchLeads])

  // Hard delete de un lead (oct 2026): solo tiene sentido sobre un lead ya
  // descartado (hay leads de prueba que ensucian la bandeja) — la policy de
  // RLS ya lo restringe a superadmin (es_superadmin()), acá no hace falta
  // una RPC porque leads no es una tabla de dinero.
  const deleteLead = useCallback(async (id) => {
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw error
    setLeads((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // Fase 3 (Recepción): un código agrupa 1-2 reservas del mismo cliente web
  // (ver `codigo` en `reservas` y `codigos_reserva`). Filtra en memoria sobre
  // los datos ya cargados, mismo patrón que el resto de los buscadores del
  // CRM (search global, Clientes por comprobante — ver CLAUDE.md
  // "Búsqueda"), nunca un query nuevo a la base.
  const buscarPorCodigo = useCallback((codigo) => {
    if (!codigo) return null
    const codigoRow = codigosReserva.find((c) => c.codigo === codigo)
    if (!codigoRow) return null
    const reservasDelCodigo = reservas.filter((r) => r.codigo === codigo)
    return { codigoRow, reservas: reservasDelCodigo }
  }, [codigosReserva, reservas])

  // RPC transaccional de Recepción (cobro + check-in + ajuste de precio por
  // método distinto al previsto) — ver migración fase3_02_recepcion_cobrar.
  const recepcionCobrar = useCallback(async ({ codigo, medio, cobrar, hacerCheckin, ajustarPrecio }) => {
    const { data, error } = await supabase.rpc('recepcion_cobrar', {
      p_codigo: codigo, p_medio: medio, p_cobrar: !!cobrar,
      p_hacer_checkin: !!hacerCheckin, p_ajustar_precio: !!ajustarPrecio,
    })
    if (error) throw error
    await Promise.all([fetchReservas(), fetchPagos(), fetchCaja(), fetchCodigosReserva()])
    return data
  }, [fetchReservas, fetchPagos, fetchCaja, fetchCodigosReserva])

  const temporadaActiva = useMemo(() => temporadas.find((t) => t.estado === 'activa') || null, [temporadas])

  const value = useMemo(() => ({
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja,
    eventos, leads, pagos, temporadas, temporadaActiva, codigosReserva, loading, error, realtimeConectado,
    createReserva, crearReservaConPago, updateReserva, deleteReserva, cancelarReserva, crearGrupoReservas,
    createCliente, updateCliente, deleteCliente, deleteUnidad, agregarCosocio, quitarCosocio,
    iniciarCaja, registrarGasto, anularGasto, cerrarCaja, reabrirCaja,
    updateLead, deleteLead, registrarPago, anularPago, completarComprobante, editarComprobante, editarMontoPago, editarMontoPagoVigente, editarPagoCompleto, emitirComprobante,
    cambiarEstadoPagoManual, revertirEstadoPagoAutomatico,
    buscarPorCodigo, recepcionCobrar,
    refetchAll, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos,
    fetchTodosGastos, fetchIngresosCaja, fetchTemporadas, fetchCodigosReserva,
  }), [
    reservas, unidades, clientes, cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja,
    eventos, leads, pagos, temporadas, temporadaActiva, codigosReserva, loading, error, realtimeConectado,
    createReserva, crearReservaConPago, updateReserva, deleteReserva, cancelarReserva, crearGrupoReservas,
    createCliente, updateCliente, deleteCliente, deleteUnidad, agregarCosocio, quitarCosocio,
    iniciarCaja, registrarGasto, anularGasto, cerrarCaja, reabrirCaja,
    updateLead, deleteLead, registrarPago, anularPago, completarComprobante, editarComprobante, editarMontoPago, editarMontoPagoVigente, editarPagoCompleto, emitirComprobante,
    cambiarEstadoPagoManual, revertirEstadoPagoAutomatico,
    buscarPorCodigo, recepcionCobrar,
    refetchAll, fetchReservas, fetchClientes, fetchCaja, fetchEventos, fetchLeads, fetchPagos,
    fetchTodosGastos, fetchIngresosCaja, fetchTemporadas, fetchCodigosReserva,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}

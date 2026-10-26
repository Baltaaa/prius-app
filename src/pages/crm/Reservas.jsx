import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatPesosVisible, formatFecha, formatRangoFechas, unidadEmoji } from '../../lib/format'
import DateInput from '../../components/inputs/DateInput'
import { coSocios, estadoBadgeStatus } from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { useOverlay } from '../../context/OverlayProvider'
import { registrarVisto } from '../../hooks/useRecientes'
import { linkToCliente, linkToComprobante, linkToRecepcion } from '../../lib/deepLinks'
import DataTable from '../../components/crm/DataTable'
import RegistrarPago from '../../components/crm/RegistrarPago'
import DetallePago from '../../components/crm/DetallePago'
import StatusBadge from '../../components/crm/StatusBadge'
import MontoReserva from '../../components/crm/MontoReserva'
import ConfirmDeleteModal from '../../components/crm/ConfirmDeleteModal'
import { useMountTransition } from '../../hooks/useMountTransition'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'
import ReservaDetalleContent from '../../components/crm/ReservaDetalleContent'
import ReservaListaMobile from '../../components/crm/ReservaListaMobile'
import BottomSheet from '../../components/ui-prius/BottomSheet'
import { useNuevaReserva } from '../../context/NuevaReservaProvider'
import { Filter, Check, Globe, MonitorSmartphone, X, ChevronLeft, LayoutList } from 'lucide-react'

// Identificador legible para el gate de tipeo del ConfirmDeleteModal —
// reservas.codigo no existe en el schema (queda para el sistema de reservas
// públicas), así que se arma con cliente + unidad.
const reservaIdentificador = (res) =>
  `${res.clientes?.nombre || 'S/N'} - ${res.unidades?.tipo || 'unidad'} #${res.unidades?.numero ?? '?'}`

// Reservas es la COLA OPERATIVA de alquileres acotados en el tiempo (período
// o día) — llegadas recientes, filtrable por fecha/estado. Los clientes de
// temporada completa (sin fechas) NO viven acá: son el directorio maestro,
// ver Clientes.jsx. Ver nota en CLAUDE.md "Reservas vs Clientes".
const TIPOS_OPERATIVOS = ['periodo', 'dia']

const FILTROS_ESTADO = [
  { value: 'todos', label: 'Todas' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pendiente', label: 'Pendiente' },
]

const FILTROS_TIPO = [
  { value: 'todos', label: 'Período y Día' },
  { value: 'periodo', label: 'Solo Período' },
  { value: 'dia', label: 'Solo Día' },
]

// Fecha de llegada real de una reserva: fecha_inicio para período, fecha
// para día. Temporada no tiene fecha propia (ver CLAUDE.md "Reservas vs
// Clientes") — se resuelve contra `temporadas` vía temporada_id, mismo
// patrón que `rangoEfectivo` de Ocupacion.jsx. Bug encontrado en la
// auditoría (Tarea 4): antes caía a `r.created_at` para temporada, que es
// la fecha de alta/migración de la fila, no una llegada real — 139 de 145
// reservas son de temporada, así que el filtro "Llegada desde/hasta"
// terminaba comparando casi siempre contra el dato equivocado.
const resolverFechaLlegada = (r, temporadasPorId) => {
  if (r.tipo_alquiler === 'dia') return r.fecha || null
  if (r.tipo_alquiler === 'periodo') return r.fecha_inicio || null
  if (r.tipo_alquiler === 'temporada') return temporadasPorId?.[r.temporada_id]?.fecha_inicio || null
  return null
}

export default function Reservas() {
  const { reservas, unidades, temporadas, loading: resLoading, updateReserva, deleteReserva, cancelarReserva } = useReservas()
  const { loading: cliLoading } = useClientes()
  const readyReservas = useInitialLoad(resLoading || cliLoading)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirm, alert } = useDialog()
  // Ítem 8 (25/10/2026): el modal de Nueva/Editar Reserva ya no vive acá —
  // es global (NuevaReservaProvider, montado en AppLayout). Esta página solo
  // dispara abrirEdicionReserva() para SU flujo de edición (deep-link ?id=,
  // click de fila); "Nueva Reserva" quedó como botón único en el Sidebar/
  // bottom nav, se saca el redundante que tenía esta pantalla.
  const { abrirNuevaReserva, abrirEdicionReserva } = useNuevaReserva()
  const [pagoReserva, setPagoReserva] = useState(null)
  // Item 7 (testing oct 2026): click en una instancia de pago del panel de
  // detalle abre DetallePago (comprobante, monto, fecha, método, cliente) —
  // mismo componente que ya usa Clientes.jsx para las celdas de PagosGrid.
  const [pagoDetalle, setPagoDetalle] = useState(null)
  const [showFiltros, setShowFiltros] = useState(false)
  const filtrosOverlay = useOverlay({ id: 'reservas-filtros', isOpen: showFiltros, onRequestClose: () => setShowFiltros(false) })
  const [filtroUnidadId, setFiltroUnidadId] = useState(null) // deep-link "Ver todas" desde el modal de unidad del Plano

  // Rediseño maestro-detalle (oct 2026, mock 03-reservas-*): un solo id
  // seleccionado, el breakpoint decide cómo se muestra — panel fijo
  // (≥1024px), bottom sheet (768-1023px) o pantalla completa (<768px).
  // Mismo patrón de doble matchMedia que ya usa Dashboard.jsx/TopBar.jsx.
  const [selectedReservaId, setSelectedReservaId] = useState(null)
  const [isDesktopLG, setIsDesktopLG] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mqlLg = window.matchMedia('(min-width: 1024px)')
    const mqlMobile = window.matchMedia('(max-width: 767px)')
    const updateLg = () => setIsDesktopLG(mqlLg.matches)
    const updateMobile = () => setIsMobile(mqlMobile.matches)
    mqlLg.addEventListener('change', updateLg)
    mqlMobile.addEventListener('change', updateMobile)
    return () => {
      mqlLg.removeEventListener('change', updateLg)
      mqlMobile.removeEventListener('change', updateMobile)
    }
  }, [])

  // Gate común a cancelar/eliminar: si la reserva está bloqueada, pasa primero
  // por el flujo de desbloqueo existente (mismo que el candado del modal de
  // edición) antes de dejar continuar con cualquiera de las dos acciones.
  const [confirmAction, setConfirmAction] = useState(null) // { accion: 'cancelar'|'eliminar', reserva }

  const asegurarDesbloqueada = async (res) => {
    if (!res.bloqueada) return true
    const ok = await confirm(
      'Esta reserva está bloqueada. Hay que desbloquearla primero para poder continuar. ¿Desbloquear?',
      { title: 'Desbloquear reserva' },
    )
    if (!ok) return false
    try {
      await updateReserva(res.id, { bloqueada: false })
      return true
    } catch (err) {
      await alert('No se pudo desbloquear la reserva.')
      return false
    }
  }

  const handleCancelarClick = async (res) => {
    if (!(await asegurarDesbloqueada(res))) return
    setConfirmAction({ accion: 'cancelar', reserva: { ...res, bloqueada: false } })
  }

  const handleEliminarClick = async (res) => {
    if (!(await asegurarDesbloqueada(res))) return
    setConfirmAction({ accion: 'eliminar', reserva: { ...res, bloqueada: false } })
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const { accion, reserva } = confirmAction
    try {
      if (accion === 'cancelar') {
        await cancelarReserva(reserva.id)
      } else {
        await deleteReserva(reserva.id)
      }
      setConfirmAction(null)
    } catch (err) {
      await alert(accion === 'cancelar' ? 'No se pudo cancelar la reserva.' : 'No se pudo eliminar la reserva.')
    }
  }

  // Deep-link vía linkToReserva() (Tarea 1, oct 2026): abre directo el modal
  // de edición de esa reserva — el modal mismo es el destino, no hace falta
  // resaltar ninguna fila. Bug encontrado en la auditoría de navegación
  // (Tarea 9): este modal solo sabe editar período/día (la sección "periodo"
  // / "dia" del form); una reserva de temporada abierta acá se guardaría con
  // fecha_inicio/fecha_fin en null. Temporada vive en Clientes — redirige
  // para allá en vez de abrir el modal equivocado.
  useDeepLinkTarget({
    params: ['id'],
    ready: !resLoading && !cliLoading,
    resolve: ({ id }) => {
      const res = reservas.find((r) => r.id === id)
      if (!res) return null
      if (res.tipo_alquiler === 'temporada') {
        navigate(linkToCliente(res.cliente_id, { reservaId: id }))
        return true
      }
      registrarVisto('reserva', res.id) // [feat-4]
      abrirEdicionReserva(res)
      return true
    },
  })

  // Deep-links legacy ?unidad=&tipo= / ?cliente= (oct 2026, ítem 8): quedan
  // por compatibilidad con links viejos guardados — los triggers actuales
  // (Clientes.jsx, panel de unidad del Plano) ya llaman directo a
  // abrirNuevaReserva() con prefill, sin pasar por acá ni navegar.
  useEffect(() => {
    const unidad = searchParams.get('unidad')
    if (!unidad || searchParams.get('id') || resLoading || cliLoading) return
    const tipo = searchParams.get('tipo')
    abrirNuevaReserva({ unidadId: unidad, tipoAlquiler: tipo === 'periodo' || tipo === 'dia' ? tipo : undefined })
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('unidad')
      next.delete('tipo')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, resLoading, cliLoading])

  useEffect(() => {
    const cliente = searchParams.get('cliente')
    if (!cliente || searchParams.get('id') || searchParams.get('unidad') || resLoading || cliLoading) return
    abrirNuevaReserva({ clienteId: cliente })
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('cliente')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, resLoading, cliLoading])

  // Deep-link "Ver todas" desde el Historial de la temporada del modal de
  // unidad del Plano: /app/reservas?filtroUnidad=<uuid> — filtra la cola por
  // esa unidad (solo período/día; temporada vive en Clientes).
  useEffect(() => {
    const unidad = searchParams.get('filtroUnidad')
    if (!unidad) return
    setFiltroUnidadId(unidad)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('filtroUnidad')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  // Filtros de llegada/estado/tipo persistidos en la URL (Tarea 4, oct
  // 2026): searchParams es la única fuente de verdad (no un useState en
  // paralelo) — así recargar la página y el botón atrás del navegador
  // funcionan solos, sin efectos de sincronización en los dos sentidos.
  const filtroEstado = searchParams.get('filtroEstado') || 'todos'
  const filtroTipo = searchParams.get('filtroTipo') || 'todos'
  const desde = searchParams.get('desde') || ''
  const hasta = searchParams.get('hasta') || ''
  const setFiltroParam = (key, value, defaultValue = 'todos') =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!value || value === defaultValue) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  const setFiltroEstado = (v) => setFiltroParam('filtroEstado', v)
  const setFiltroTipo = (v) => setFiltroParam('filtroTipo', v)
  const setDesde = (v) => setFiltroParam('desde', v, '')
  const setHasta = (v) => setFiltroParam('hasta', v, '')
  const limpiarFiltros = () =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('filtroEstado')
      next.delete('filtroTipo')
      next.delete('desde')
      next.delete('hasta')
      return next
    }, { replace: true })

  // Rango inválido (desde > hasta): se avisa inline y no se filtra por
  // fecha — mejor mostrar todo que mostrar una lista vacía engañosa.
  const rangoFechaInvalido = !!(desde && hasta && desde > hasta)

  const temporadasPorId = useMemo(() => {
    const map = {}
    for (const t of temporadas) map[t.id] = t
    return map
  }, [temporadas])
  const fechaLlegada = useMemo(() => (r) => resolverFechaLlegada(r, temporadasPorId), [temporadasPorId])

  // Cola operativa: solo período/día. La temporada completa vive en Clientes
  // (directorio maestro), no acá — ver CLAUDE.md.
  const reservasOperativas = useMemo(
    () => reservas.filter((r) => TIPOS_OPERATIVOS.includes(r.tipo_alquiler)),
    [reservas],
  )

  // Cuando el filtro de unidad viene del deep-link "Ver todas" del modal de
  // unidad del Plano, se le suman las reservas de temporada de esa unidad —
  // ahí sí importa ver el historial completo. Sin filtroUnidad, Reservas
  // sigue mostrando solo la cola operativa (período/día), como siempre.
  const temporadasDeUnidadFiltrada = useMemo(() => {
    if (!filtroUnidadId) return []
    return reservas.filter((r) => r.tipo_alquiler === 'temporada' && r.unidad_id === filtroUnidadId)
  }, [reservas, filtroUnidadId])

  // Búsqueda por texto (Tarea de testing, oct 2026): se sacó el buscador
  // propio de esta pantalla — el global del header ya busca cliente/unidad
  // sobre `reservas` completo (ver TopBar.jsx, `reservaMatches`/
  // `unidadMatches`) y navega acá con `?id=<reserva>` o abre el Plano con la
  // unidad resaltada. Esta grilla ahora solo filtra por estado/tipo/unidad/
  // llegada, nunca por texto libre.
  const filteredReservas = useMemo(() => {
    const base = filtroUnidadId ? [...reservasOperativas, ...temporadasDeUnidadFiltrada] : reservasOperativas
    return base
      .filter((r) => {
        const matchesEstado = filtroEstado === 'todos' || r.estado_pago === filtroEstado
        const matchesTipo = filtroTipo === 'todos' || r.tipo_alquiler === filtroTipo
        const matchesUnidad = !filtroUnidadId || r.unidad_id === filtroUnidadId
        const llegada = fechaLlegada(r)
        // Rango inválido (desde > hasta): no se filtra por fecha, se avisa
        // inline más abajo — ver `rangoFechaInvalido`.
        const matchesDesde = rangoFechaInvalido || !desde || (llegada && llegada >= desde)
        const matchesHasta = rangoFechaInvalido || !hasta || (llegada && llegada <= hasta)
        return matchesEstado && matchesTipo && matchesUnidad && matchesDesde && matchesHasta
      })
      // Llegadas más recientes primero.
      .sort((a, b) => (fechaLlegada(b) || '').localeCompare(fechaLlegada(a) || ''))
  }, [reservasOperativas, temporadasDeUnidadFiltrada, filtroEstado, filtroTipo, filtroUnidadId, desde, hasta, rangoFechaInvalido, fechaLlegada])

  const filtrosActivos = filtroEstado !== 'todos' || filtroTipo !== 'todos' || desde || hasta

  // Reserva seleccionada para el panel/sheet/pantalla de detalle — se busca
  // en `reservas` (no en `filteredReservas`) para que no desaparezca de
  // golpe si cambia un filtro mientras el detalle está abierto.
  const selectedReserva = selectedReservaId ? reservas.find((r) => r.id === selectedReservaId) : null
  const handleCloseDetalle = () => setSelectedReservaId(null)
  const handleOpenDetalle = (res) => setSelectedReservaId(res.id)
  const handleCheckIn = (res) => navigate(linkToRecepcion(res.codigo))
  // Pantalla completa mobile: igual que UnidadPreviewModal del Plano, se
  // congela la última reserva real mientras dura la animación de cierre
  // (B1) — `selectedReserva` llega en null para señalizar el cierre.
  const mobileDetalleShouldRender = useMountTransition(isMobile && !!selectedReserva)
  const lastDetalleReservaRef = useRef(selectedReserva)
  if (selectedReserva) lastDetalleReservaRef.current = selectedReserva
  const mobileDetalleReserva = selectedReserva ?? lastDetalleReservaRef.current

  // Unidad del filtro deep-link, solo para mostrar el chip con su nombre.
  const unidadFiltrada = filtroUnidadId ? unidades.find((u) => u.id === filtroUnidadId) : null

  // Columna "Acciones" sacada (testing oct 2026): esos mismos botones ya
  // viven en la ficha lateral/bottom sheet que abre el click de la fila
  // (ReservaDetalleContent) — tenerlos repetidos en la grilla era redundante.
  const headers = ['Llegada', 'Cliente', 'Unidad', 'Monto Total', 'Saldo', 'Estado', 'Origen']
  // Anchos fijos (ítem 7, oct 2026) para que nada se parta a dos líneas en
  // 1280/1366/1440: todas las columnas salvo "Cliente" quedan en un ancho
  // fijo que entra con nowrap — "Cliente" (sin ancho acá) se lleva el resto
  // y es la única que puede wrappear a dos líneas. Con table-fixed el ancho
  // total de la tabla es SIEMPRE la suma de estos anchos (el contenido que
  // no entra wrappea/se recorta adentro de su celda, nunca agranda la
  // tabla) — medido contra el espacio real disponible junto al panel fijo
  // (que bajó de w-96 a w-80 para esto, ver más abajo) en 1280/1366/1440.
  const columnWidths = ['80px', undefined, '100px', '108px', '96px', '92px', '88px']

  // Unidades con una reserva de TEMPORADA activa: quedan tomadas para toda la
  // temporada sin importar qué fecha se elija, así que ni siquiera aparecen
  // como opción para una reserva nueva de período/día — evita un doble
  if (!readyReservas) {
    return (
      <div className="space-y-6 lg:space-y-10 font-ui">
        <div className="flex flex-wrap gap-4">
          <Skeleton className="flex-1 min-w-[160px] h-12" />
          <Skeleton className="w-40 h-12" />
          <Skeleton className="w-40 h-12" />
          <Skeleton className="w-32 h-12" />
          <Skeleton className="w-40 h-12" />
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="hidden lg:block w-96 h-96 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade font-ui">
      {/* Toolbar / filtros — feed cronológico con filtros siempre visibles,
          pegado al navbar, con el alta en la misma fila. */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Buscador propio sacado (testing oct 2026): el global del header ya
            busca cliente/unidad sobre todas las reservas y navega acá con
            ?id=<reserva> — un solo buscador en toda la app, ver CLAUDE.md
            "Navegación y deep-linking". El espacio libre lo usan los
            filtros de fecha, que ahora pueden crecer un poco más. */}
        <div className="flex items-center gap-1">
          <DateInput value={desde || null} onChange={(v) => setDesde(v || '')} placeholder="Llegada desde" className="w-44" />
          {desde && (
            <button type="button" onClick={() => setDesde('')} className="p-2 text-prius-muted hover:text-black transition-all" title="Limpiar 'Llegada desde'">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DateInput value={hasta || null} onChange={(v) => setHasta(v || '')} placeholder="Llegada hasta" min={desde || undefined} className="w-44" />
          {hasta && (
            <button type="button" onClick={() => setHasta('')} className="p-2 text-prius-muted hover:text-black transition-all" title="Limpiar 'Llegada hasta'">
              <X size={14} />
            </button>
          )}
        </div>
        <div ref={filtrosOverlay.bind} className="relative">
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`card-light px-4 py-3 min-h-[44px] rounded-xl flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest ${filtrosActivos ? 'text-gold' : 'text-prius-slate hover:text-black'}`}
          >
            <Filter size={16} /> Filtros {filtrosActivos ? 'Activos' : ''}
          </button>

          {showFiltros && (
              <div className="absolute right-0 mt-2 w-56 card-light rounded-xl overflow-hidden z-50 p-3 space-y-3">
                <div>
                  <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest mb-1 px-1">Estado de pago</p>
                  {FILTROS_ESTADO.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFiltroEstado(f.value)}
                      className="w-full text-left px-3 py-2 text-xs text-prius-slate hover:bg-prius-subtle flex items-center justify-between rounded-lg"
                    >
                      {f.label}
                      {filtroEstado === f.value && <Check size={14} className="text-gold" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-hairline pt-2">
                  <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest mb-1 px-1">Tipo de alquiler</p>
                  {FILTROS_TIPO.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFiltroTipo(f.value)}
                      className="w-full text-left px-3 py-2 text-xs text-prius-slate hover:bg-prius-subtle flex items-center justify-between rounded-lg"
                    >
                      {f.label}
                      {filtroTipo === f.value && <Check size={14} className="text-gold" />}
                    </button>
                  ))}
                </div>
                {filtrosActivos && (
                  <button
                    onClick={() => { limpiarFiltros(); setShowFiltros(false) }}
                    className="w-full text-center px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-prius-error hover:bg-red-500/10 rounded-lg border-t border-hairline pt-3"
                  >
                    Limpiar todos los filtros
                  </button>
                )}
              </div>
          )}
        </div>
      </div>

      {/* Envoltorio condicional (ítem 7, oct 2026): sin chips activos este
          div no debe existir, porque el `space-y-10` del contenedor padre
          le metía el mismo gap de 40px que a cualquier hermano con
          contenido real — quedaba un salto vacío entre los filtros y la
          tabla aunque no hubiera ningún chip para mostrar. */}
      {(unidadFiltrada || ((desde || hasta) && !rangoFechaInvalido)) && (
      <div className="flex flex-wrap gap-2">
        {unidadFiltrada && (
          <button
            onClick={() => setFiltroUnidadId(null)}
            className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gold/20 transition-all"
            title="Quitar filtro de unidad"
          >
            {unidadEmoji(unidadFiltrada.tipo)} {unidadFiltrada.tipo} #{unidadFiltrada.numero} <X size={12} />
          </button>
        )}
        {(desde || hasta) && !rangoFechaInvalido && (
          <button
            onClick={() => { setDesde(''); setHasta('') }}
            className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-400/20 transition-all"
            title="Quitar filtro de llegada"
          >
            Llegada {desde && hasta ? formatRangoFechas(desde, hasta, true) : desde ? `desde ${formatFecha(desde)}` : `hasta ${formatFecha(hasta)}`}
            <X size={12} />
          </button>
        )}
      </div>
      )}
      {rangoFechaInvalido && (
        <p className="text-xs font-bold text-prius-error uppercase tracking-widest">
          "Llegada desde" no puede ser posterior a "Llegada hasta" — corregí el rango para filtrar por fecha.
        </p>
      )}

      {/* Mobile (<768px, mock 03-reservas-mobile): lista agrupada por fecha
          de llegada, componente aparte — reemplaza por completo a la
          DataTable/sus tarjetas en este ancho. */}
      {isMobile && (
        <ReservaListaMobile
          reservas={filteredReservas}
          fechaLlegada={fechaLlegada}
          onOpenDetalle={handleOpenDetalle}
          onIrACliente={(res) => navigate(linkToCliente(res.cliente_id))}
          onRegistrarPago={setPagoReserva}
          onComprobante={(res) => navigate(linkToComprobante(res.id))}
          onCheckIn={handleCheckIn}
        />
      )}

      {/* Tablet/desktop (≥768px, mock 03-reservas-desktop): tabla maestro a
          la izquierda + detalle a la derecha. El panel fijo solo se ve en
          ≥1024px (`hidden lg:flex`); 768-1023px usa el BottomSheet de más
          abajo en cambio — mismo patrón dual-render que UnidadPreviewModal/
          UnidadDetallePanel del Plano. */}
      {!isMobile && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
      <DataTable
        headers={headers}
        data={filteredReservas}
        columnWidths={columnWidths}
        emptyMessage={filtroUnidadId ? 'No hay reservas registradas para esta unidad.' : 'No hay reservas de período/día con esos filtros.'}
        renderRow={(res) => {
          // Fila de temporada (solo aparece con el deep-link "Ver todas" por
          // unidad): no se edita/cancela/elimina desde acá — Reservas es solo
          // la cola operativa de período/día, temporada vive en Clientes (ver
          // CLAUDE.md "Reservas vs Clientes"). Toda la fila navega para allá.
          if (res.tipo_alquiler === 'temporada') {
            return (
              <tr
                key={res.id}
                onClick={() => navigate(linkToCliente(res.cliente_id))}
                className="hover:bg-prius-subtle transition-all group cursor-pointer"
              >
                <td className="px-3 py-4 align-middle text-prius-slate font-medium whitespace-nowrap">{formatFecha(fechaLlegada(res))}</td>
                <td className="px-3 py-4 align-middle font-bold text-black uppercase break-words">
                  {res.clientes?.nombre || 'S/N'}
                  {coSocios(res).length > 0 && (
                    <p className="text-[10px] text-prius-muted font-normal normal-case tracking-widest mt-0.5">
                      Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-3 py-4 align-middle font-medium text-prius-slate uppercase whitespace-nowrap">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-3 py-4 align-middle font-bold text-black"><MontoReserva reserva={res} /></td>
                <td className="px-3 py-4 align-middle font-bold text-prius-error whitespace-nowrap">
                  {formatPesosVisible(res.saldo)}
                </td>
                <td className="px-3 py-4 align-middle">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={estadoBadgeStatus(res)} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 border border-cyan-400/30 rounded px-1.5 py-0.5">
                      Temporada
                    </span>
                  </div>
                </td>
                <td className="px-3 py-4 align-middle">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-prius-muted">
                    {res.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                    {res.origen === 'web' ? 'Web' : 'Manual'}
                  </span>
                </td>
              </tr>
            )
          }
          return (
            <tr
              key={res.id}
              onClick={() => handleOpenDetalle(res)}
              className={`hover:bg-prius-subtle transition-all group cursor-pointer ${selectedReservaId === res.id ? 'bg-prius-subtle' : ''}`}
            >
              <td className="px-3 py-4 align-middle text-prius-slate font-medium whitespace-nowrap">{formatFecha(fechaLlegada(res))}</td>
              <td className="px-3 py-4 align-middle font-bold text-black uppercase break-words">
                {res.clientes?.nombre || 'S/N'}
                {coSocios(res).length > 0 && (
                  <p className="text-[10px] text-prius-muted font-normal normal-case tracking-widest mt-0.5">
                    Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                  </p>
                )}
              </td>
              <td className="px-3 py-4 align-middle font-medium text-prius-slate uppercase whitespace-nowrap">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
              <td className="px-3 py-4 align-middle font-bold text-black"><MontoReserva reserva={res} /></td>
              <td className="px-3 py-4 align-middle font-bold text-prius-error whitespace-nowrap">
                {formatPesosVisible(res.saldo)}
              </td>
              <td className="px-3 py-4 align-middle">
                <StatusBadge status={estadoBadgeStatus(res)} />
              </td>
              <td className="px-3 py-4 align-middle">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-prius-muted">
                  {res.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                  {res.origen === 'web' ? 'Web' : 'Manual'}
                </span>
              </td>
            </tr>
          )
        }}
      />
          </div>

          {/* Panel fijo — solo ≥1024px. Altura fija (no max-h) + key por id
              para el crossfade (mismo patrón que Clientes.jsx, ítem 6, oct
              2026): nunca cambia de tamaño al elegir/deseleccionar una
              reserva, y el contenido hace fade+shift de 180ms al cambiar. */}
          <aside className="hidden lg:flex w-72 shrink-0 card-light rounded-2xl p-space-lg flex-col overflow-hidden sticky top-4 self-start h-[calc(100vh-2rem)]">
            {selectedReserva ? (
              <div key={selectedReserva.id} className="content-crossfade flex-1 min-h-0 flex flex-col">
                <ReservaDetalleContent
                  reserva={selectedReserva}
                  fechaLlegada={fechaLlegada}
                  onClose={handleCloseDetalle}
                  onRegistrarPago={setPagoReserva}
                  onEditar={abrirEdicionReserva}
                  onCancelar={handleCancelarClick}
                  onEliminar={handleEliminarClick}
                  onCellClick={(res, pago) => setPagoDetalle({ reserva: res, pago })}
                />
              </div>
            ) : (
              <div key="empty" className="content-crossfade flex-1 flex flex-col items-center justify-center text-center gap-3 text-prius-muted">
                <LayoutList size={28} />
                <p className="text-body-md">Elegí una reserva para ver el detalle</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Tablet (768-1023px): mismo detalle, como bottom sheet — reusa
          BottomSheet.jsx (B1: animación de apertura/cierre real). */}
      {!isMobile && !isDesktopLG && (
        <BottomSheet isOpen={!!selectedReserva} onClose={handleCloseDetalle} maxHeightClass="max-h-[88vh]">
          {selectedReserva && (
            <ReservaDetalleContent
              reserva={selectedReserva}
              fechaLlegada={fechaLlegada}
              onClose={handleCloseDetalle}
              onRegistrarPago={setPagoReserva}
              onEditar={abrirEdicionReserva}
              onCancelar={handleCancelarClick}
              onEliminar={handleEliminarClick}
              onCellClick={(res, pago) => setPagoDetalle({ reserva: res, pago })}
              showCloseButton={false}
            />
          )}
        </BottomSheet>
      )}

      {/* Mobile (<768px, mock 03-reservas-mobile-detalle): pantalla completa
          con flecha de volver, acciones fijas abajo (adentro de
          ReservaDetalleContent). Vía portal a document.body (fix oct 2026,
          detectado al construir el mismo patrón en Clientes.jsx): el
          wrapper raíz de esta página usa `animate-premium-fade`, cuya
          animación deja un `transform` aplicado (fill-mode `both`) después
          de terminar — eso lo convierte en containing block de cualquier
          `position:fixed` anidado adentro (mismo bug ya documentado en
          CLAUDE.md para el portal del date picker), así que sin portal este
          overlay quedaba recortado a la altura del contenido scrolleable de
          la página en vez de cubrir el viewport real, dejando el BottomNav
          visible encima del detalle. */}
      {isMobile && mobileDetalleShouldRender && createPortal(
        <div className={`fixed inset-0 z-[995] bg-white flex flex-col ${selectedReserva ? 'ui-open' : 'ui-close'}`}>
          <div className="flex items-center gap-2 px-2 h-16 border-b border-hairline shrink-0">
            <button onClick={handleCloseDetalle} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-prius-slate hover:text-black">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-sm font-bold uppercase tracking-widest text-black">Detalle Reserva</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-space-lg pb-space-lg flex flex-col min-h-0">
            <ReservaDetalleContent
              reserva={mobileDetalleReserva}
              fechaLlegada={fechaLlegada}
              onClose={handleCloseDetalle}
              onRegistrarPago={setPagoReserva}
              onEditar={abrirEdicionReserva}
              onCancelar={handleCancelarClick}
              onEliminar={handleEliminarClick}
              onCellClick={(res, pago) => setPagoDetalle({ reserva: res, pago })}
              showCloseButton={false}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* Registrar Pago (Tarea 4) — mismo componente que usa Clientes y el Plano */}
      <RegistrarPago
        isOpen={!!pagoReserva}
        onClose={() => setPagoReserva(null)}
        cliente={pagoReserva?.clientes}
        reservasOptions={pagoReserva ? [pagoReserva] : []}
        initialReservaId={pagoReserva?.id || ''}
        allowSinReserva={false}
      />

      {/* Item 7 (testing oct 2026): click en una instancia de pago del panel
          de detalle de reserva abre el mismo DetallePago que ya usa
          Clientes.jsx (comprobante, monto, fecha, método, cliente). */}
      <DetallePago
        isOpen={!!pagoDetalle}
        onClose={() => setPagoDetalle(null)}
        pago={pagoDetalle?.pago}
        reserva={pagoDetalle?.reserva}
      />

      <ConfirmDeleteModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        accion={confirmAction?.accion}
        tipo="reserva"
        identificador={confirmAction ? reservaIdentificador(confirmAction.reserva) : ''}
        detalle={
          confirmAction?.accion === 'eliminar'
            ? 'Se borran también todos los pagos asociados a esta reserva. No se puede deshacer.'
            : 'La unidad y las fechas quedan libres. Los pagos y el historial no se borran.'
        }
      />
    </div>
  )
}

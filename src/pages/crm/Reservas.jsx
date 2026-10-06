import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatPesos, formatPesosVisible, formatFecha, formatRangoFechas, unidadEmoji } from '../../lib/format'
import { parseUnidadQuery } from '../../lib/parse'
import SearchInput from '../../components/inputs/SearchInput'
import DateInput from '../../components/inputs/DateInput'
import BrandSelect from '../../components/ui/BrandSelect'
import { coSocios, estaSaldada, rangosOcupadosPorUnidad, estadoBadgeStatus } from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { useDebounced } from '../../hooks/useDebounced'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { linkToCliente } from '../../lib/deepLinks'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import RegistrarPago from '../../components/crm/RegistrarPago'
import MoneyInput from '../../components/inputs/MoneyInput'
import ClienteSelector from '../../components/crm/ClienteSelector'
import StatusBadge from '../../components/crm/StatusBadge'
import MontoReserva from '../../components/crm/MontoReserva'
import ReservaCalendar from '../../components/crm/ReservaCalendar'
import Historial from '../../components/crm/Historial'
import ConfirmDeleteModal from '../../components/crm/ConfirmDeleteModal'
import { Plus, Edit2, Trash2, XCircle, Search, Filter, Check, Wallet, Globe, MonitorSmartphone, X, Lock, Unlock } from 'lucide-react'

// Identificador legible para el gate de tipeo del ConfirmDeleteModal —
// reservas.codigo no existe en el schema (queda para el sistema de reservas
// públicas), así que se arma con cliente + unidad.
const reservaIdentificador = (res) =>
  `${res.clientes?.nombre || 'S/N'} - ${res.unidades?.tipo || 'unidad'} #${res.unidades?.numero ?? '?'}`

// ¿Dos rangos de fechas (yyyy-mm-dd, comparables como string) se superponen?
const rangosSolapan = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && bStart <= aEnd

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
  const { reservas, unidades, temporadas, temporadaActiva, loading: resLoading, createReserva, updateReserva, deleteReserva, cancelarReserva } = useReservas()
  const { loading: cliLoading } = useClientes()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirm, alert } = useDialog()
  const puedeBonificar = usePermiso('bonificar')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [pagoReserva, setPagoReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtroUnidadId, setFiltroUnidadId] = useState(null) // deep-link "Ver todas" desde el modal de unidad del Plano

  // Form state
  const [clienteId, setClienteId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [tipoAlquiler, setTipoAlquiler] = useState('periodo')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [fecha, setFecha] = useState('')
  const [valorTotal, setValorTotal] = useState(0)
  const [notas, setNotas] = useState('')
  // Candado (Frente disponibilidad dinámica): con bloqueada=true, fecha/unidad
  // quedan de solo lectura en este form — cliente y pagos siguen editables
  // siempre. Se persiste al tocar el candado, no en el submit del form.
  const [bloqueada, setBloqueada] = useState(false)
  // Unidad bonificada (sep 2026): al activarla, el precio se fuerza a 0 y
  // queda deshabilitado — el trigger fn_reserva_recalcula_saldo hace cumplir
  // esto igual en la base (costo_total=0, estado_pago='pagado'), así que acá
  // solo se refleja para no confundir al que carga el form.
  const [bonificada, setBonificada] = useState(false)

  const resetForm = () => {
    setClienteId('')
    setUnidadId('')
    setTipoAlquiler('periodo')
    setFechaInicio('')
    setFechaFin('')
    setFecha('')
    setValorTotal(0)
    setNotas('')
    setBloqueada(false)
    setBonificada(false)
  }

  const handleOpenCreate = () => {
    setEditingReserva(null)
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (res) => {
    setEditingReserva(res)
    setClienteId(res.cliente_id || '')
    setUnidadId(res.unidad_id || '')
    setTipoAlquiler(res.tipo_alquiler || 'periodo')
    setFechaInicio(res.fecha_inicio || '')
    setFechaFin(res.fecha_fin || '')
    setFecha(res.fecha || '')
    setValorTotal(res.valor_total ?? 0)
    setNotas(res.notas || '')
    setBloqueada(res.bloqueada || false)
    setBonificada(res.bonificada || false)
    setIsModalOpen(true)
  }

  const handleToggleBloqueada = async () => {
    if (!editingReserva) return
    if (bloqueada) {
      const ok = await confirm(
        'Vas a desbloquear esta reserva para poder editar fecha/unidad. ¿Confirmás?',
        { title: 'Desbloquear reserva' },
      )
      if (!ok) return
    }
    const nuevoValor = !bloqueada
    try {
      await updateReserva(editingReserva.id, { bloqueada: nuevoValor })
      setBloqueada(nuevoValor)
      setEditingReserva((prev) => (prev ? { ...prev, bloqueada: nuevoValor } : prev))
    } catch (err) {
      await alert('No se pudo actualizar el candado de la reserva.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId) {
      await alert('Seleccioná un cliente antes de continuar.')
      return
    }
    // El date picker (Tarea 7) reemplazó los <input type="date" required> —
    // se valida acá que haya fecha(s) elegida(s), ya sin validación nativa del form.
    if (!bloqueada) {
      if (tipoAlquiler === 'periodo' && (!fechaInicio || !fechaFin)) {
        await alert('Elegí el rango de fechas de la reserva en el calendario.')
        return
      }
      if (tipoAlquiler === 'dia' && !fecha) {
        await alert('Elegí la fecha de la reserva en el calendario.')
        return
      }
    }
    if (unidadTieneConflictoDeFechas(unidadId)) {
      await alert('Esa unidad ya está ocupada en las fechas elegidas por otra reserva. Elegí otra unidad o cambiá las fechas.')
      return
    }
    // Con bloqueada=true, fecha/unidad quedan de solo lectura en el DOM, pero
    // se refuerza acá para no confiar solo en el disabled del input.
    const payload = {
      cliente_id: clienteId,
      unidad_id: bloqueada && editingReserva ? editingReserva.unidad_id : unidadId,
      // temporada / temporada_id NO se mandan: en un alta nueva los asigna
      // solo el trigger fn_reserva_asigna_temporada (temporada activa,
      // Frente 2); en una edición se omiten para no tocar la temporada
      // original de una reserva ya creada (una reserva vieja no debe migrar
      // de temporada por editarla).
      tipo_alquiler: bloqueada && editingReserva ? editingReserva.tipo_alquiler : tipoAlquiler,
      estado: 'activa',
      // Reservas solo da de alta período/día — todavía manual (sin origen web).
      origen: 'manual',
      fecha_inicio:
        bloqueada && editingReserva
          ? editingReserva.fecha_inicio
          : tipoAlquiler === 'periodo' ? fechaInicio || null : null,
      fecha_fin:
        bloqueada && editingReserva
          ? editingReserva.fecha_fin
          : tipoAlquiler === 'periodo' ? fechaFin || null : null,
      fecha:
        bloqueada && editingReserva
          ? editingReserva.fecha
          : tipoAlquiler === 'dia' ? fecha || null : null,
      valor_total: bonificada ? 0 : Number(valorTotal || 0),
      bonificada,
      // saldo / estado_pago ya no se cargan a mano: los recalcula el trigger
      // fn_reserva_recalcula_saldo (a partir de valor_total/bonificada y la
      // suma de `pagos`) — ver RegistrarPago / usePagos.
      notas,
    }
    try {
      if (editingReserva) {
        await updateReserva(editingReserva.id, payload)
      } else {
        await createReserva(payload)
      }
      setIsModalOpen(false)
    } catch (err) {
      await alert('Error guardando la reserva.')
    }
  }

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
      handleOpenEdit(res)
      return true
    },
  })

  // Deep-link desde "Nueva reserva por período o día" en el modal de unidad
  // del Plano: /app/reservas?unidad=<uuid>&tipo=periodo|dia — abre el alta
  // con la unidad ya elegida.
  useEffect(() => {
    const unidad = searchParams.get('unidad')
    if (!unidad || searchParams.get('id') || resLoading || cliLoading) return
    const tipo = searchParams.get('tipo')
    handleOpenCreate()
    setUnidadId(unidad)
    if (tipo === 'periodo' || tipo === 'dia') setTipoAlquiler(tipo)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('unidad')
      next.delete('tipo')
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

  const debouncedSearch = useDebounced(searchTerm)

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

  const filteredReservas = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    const unidadQuery = parseUnidadQuery(term)
    const base = filtroUnidadId ? [...reservasOperativas, ...temporadasDeUnidadFiltrada] : reservasOperativas
    return base
      .filter((r) => {
        const matchesSearch =
          !term ||
          r.clientes?.nombre?.toLowerCase().includes(term) ||
          String(r.unidades?.numero ?? '').includes(term) ||
          (unidadQuery && r.unidades?.numero === unidadQuery.numero && (!unidadQuery.tipo || r.unidades?.tipo === unidadQuery.tipo))
        const matchesEstado = filtroEstado === 'todos' || r.estado_pago === filtroEstado
        const matchesTipo = filtroTipo === 'todos' || r.tipo_alquiler === filtroTipo
        const matchesUnidad = !filtroUnidadId || r.unidad_id === filtroUnidadId
        const llegada = fechaLlegada(r)
        // Rango inválido (desde > hasta): no se filtra por fecha, se avisa
        // inline más abajo — ver `rangoFechaInvalido`.
        const matchesDesde = rangoFechaInvalido || !desde || (llegada && llegada >= desde)
        const matchesHasta = rangoFechaInvalido || !hasta || (llegada && llegada <= hasta)
        return matchesSearch && matchesEstado && matchesTipo && matchesUnidad && matchesDesde && matchesHasta
      })
      // Llegadas más recientes primero.
      .sort((a, b) => (fechaLlegada(b) || '').localeCompare(fechaLlegada(a) || ''))
  }, [reservasOperativas, temporadasDeUnidadFiltrada, debouncedSearch, filtroEstado, filtroTipo, filtroUnidadId, desde, hasta, rangoFechaInvalido, fechaLlegada])

  const filtrosActivos = filtroEstado !== 'todos' || filtroTipo !== 'todos' || desde || hasta

  // Unidad del filtro deep-link, solo para mostrar el chip con su nombre.
  const unidadFiltrada = filtroUnidadId ? unidades.find((u) => u.id === filtroUnidadId) : null

  const headers = ['Llegada', 'Cliente', 'Unidad', 'Monto Total', 'Saldo', 'Estado', 'Origen', 'Acciones']

  // Unidades con una reserva de TEMPORADA activa: quedan tomadas para toda la
  // temporada sin importar qué fecha se elija, así que ni siquiera aparecen
  // como opción para una reserva nueva de período/día — evita un doble
  // alquiler sobre la unidad de un abonado.
  const unidadesBloqueadasPorTemporada = useMemo(() => {
    const set = new Set()
    for (const r of reservas) {
      if (r.tipo_alquiler === 'temporada' && r.estado === 'activa' && r.unidad_id) set.add(r.unidad_id)
    }
    return set
  }, [reservas])

  // ¿Esta unidad ya tiene otra reserva de período/día activa que se solapa
  // con las fechas elegidas en el form? Sin fechas cargadas todavía, no hay
  // nada que chequear (se habilita a medida que se completan).
  const unidadTieneConflictoDeFechas = (unidadId) => {
    const candStart = tipoAlquiler === 'dia' ? fecha : fechaInicio
    const candEnd = tipoAlquiler === 'dia' ? fecha : fechaFin
    if (!candStart || !candEnd) return false
    return reservas.some((r) => {
      if (r.unidad_id !== unidadId || r.estado !== 'activa') return false
      if (editingReserva && r.id === editingReserva.id) return false
      if (r.tipo_alquiler !== 'periodo' && r.tipo_alquiler !== 'dia') return false
      const rStart = r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_inicio
      const rEnd = r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_fin
      return rStart && rEnd && rangosSolapan(candStart, candEnd, rStart, rEnd)
    })
  }

  // Lista de unidades seleccionables: saca las tomadas por temporada y, si ya
  // hay fechas cargadas, también las que se solapan con otra reserva — salvo
  // la que ya está elegida, que se conserva siempre para que el <select> no
  // se quede con un value sin option (y para poder mostrarle el aviso).
  const unidadesDisponibles = useMemo(
    () =>
      unidades.filter(
        (u) => u.id === unidadId || (!unidadesBloqueadasPorTemporada.has(u.id) && !unidadTieneConflictoDeFechas(u.id)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unidades, unidadesBloqueadasPorTemporada, unidadId, tipoAlquiler, fechaInicio, fechaFin, fecha, reservas, editingReserva],
  )

  const conflictoFechas = unidadId ? unidadTieneConflictoDeFechas(unidadId) : false

  const GRUPO_UNIDAD = { carpa: 'Carpas', sombrilla: 'Sombrillas', cabina: 'Cabinas', locker: 'Lockers' }
  const opcionesUnidad = useMemo(
    () =>
      [...unidadesDisponibles]
        .sort((a, b) => (GRUPO_UNIDAD[a.tipo] || a.tipo).localeCompare(GRUPO_UNIDAD[b.tipo] || b.tipo) || a.numero - b.numero)
        .map((u) => ({
          value: u.id,
          group: GRUPO_UNIDAD[u.tipo] || u.tipo,
          label: `${unidadEmoji(u.tipo)} ${u.tipo} #${u.numero}${u.id === unidadId && conflictoFechas ? ' (ocupada esas fechas)' : ''}`,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unidadesDisponibles, unidadId, conflictoFechas],
  )

  // Días ya ocupados por otra reserva período/día de la unidad elegida, para
  // tacharlos/bloquearlos en el date picker del form (Tarea 7) — misma regla
  // que el exclusion constraint de la base, ver lib/reservas.js.
  const rangosOcupados = useMemo(
    () => rangosOcupadosPorUnidad(reservas, unidadId, editingReserva?.id),
    [reservas, unidadId, editingReserva],
  )

  if (resLoading || cliLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Cargando Reservas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Toolbar / filtros — feed cronológico con filtros siempre visibles,
          pegado al navbar, con el alta en la misma fila. */}
      <div className="flex flex-wrap gap-4 items-center">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por cliente o unidad (ej. carpa 19)..."
          className="flex-1 min-w-[160px]"
          inputClassName="focus:border-[#FDE047]/50 py-3"
        />
        <div className="flex items-center gap-1">
          <DateInput value={desde || null} onChange={(v) => setDesde(v || '')} placeholder="Llegada desde" className="w-40" />
          {desde && (
            <button type="button" onClick={() => setDesde('')} className="p-2 text-gray-500 hover:text-white transition-all" title="Limpiar 'Llegada desde'">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DateInput value={hasta || null} onChange={(v) => setHasta(v || '')} placeholder="Llegada hasta" min={desde || undefined} className="w-40" />
          {hasta && (
            <button type="button" onClick={() => setHasta('')} className="p-2 text-gray-500 hover:text-white transition-all" title="Limpiar 'Llegada hasta'">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`glass-card px-4 py-3 rounded-xl flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest ${filtrosActivos ? 'text-[#FDE047]' : 'text-gray-400 hover:text-white'}`}
          >
            <Filter size={16} /> Filtros {filtrosActivos ? 'Activos' : ''}
          </button>

          {showFiltros && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFiltros(false)} />
              <div className="absolute right-0 mt-2 w-56 glass-card rounded-xl overflow-hidden z-50 p-3 space-y-3">
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 px-1">Estado de pago</p>
                  {FILTROS_ESTADO.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFiltroEstado(f.value)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center justify-between rounded-lg"
                    >
                      {f.label}
                      {filtroEstado === f.value && <Check size={14} className="text-[#FDE047]" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-2">
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 px-1">Tipo de alquiler</p>
                  {FILTROS_TIPO.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFiltroTipo(f.value)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center justify-between rounded-lg"
                    >
                      {f.label}
                      {filtroTipo === f.value && <Check size={14} className="text-[#FDE047]" />}
                    </button>
                  ))}
                </div>
                {filtrosActivos && (
                  <button
                    onClick={() => { limpiarFiltros(); setShowFiltros(false) }}
                    className="w-full text-center px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-lg border-t border-white/10 pt-3"
                  >
                    Limpiar todos los filtros
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl shrink-0"
        >
          <Plus size={18} /> Nueva Reserva
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {unidadFiltrada && (
          <button
            onClick={() => setFiltroUnidadId(null)}
            className="inline-flex items-center gap-2 bg-[#FDE047]/10 border border-[#FDE047]/30 text-[#FDE047] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#FDE047]/20 transition-all"
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
      {rangoFechaInvalido && (
        <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
          "Llegada desde" no puede ser posterior a "Llegada hasta" — corregí el rango para filtrar por fecha.
        </p>
      )}

      {/* Table Section */}
      <DataTable
        headers={headers}
        data={filteredReservas}
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
                className="hover:bg-white/5 transition-all group cursor-pointer"
              >
                <td className="px-6 py-5 text-gray-300 font-medium whitespace-nowrap">{formatFecha(fechaLlegada(res))}</td>
                <td className="px-6 py-5 font-bold text-white uppercase">
                  {res.clientes?.nombre || 'S/N'}
                  {coSocios(res).length > 0 && (
                    <p className="text-[10px] text-gray-500 font-normal normal-case tracking-widest mt-0.5">
                      Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-6 py-5 font-medium text-gray-300 uppercase">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-6 py-5 font-bold text-white"><MontoReserva reserva={res} /></td>
                <td className="px-6 py-5 font-bold text-red-400">
                  {formatPesosVisible(res.saldo)}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={estadoBadgeStatus(res)} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 border border-cyan-400/30 rounded px-1.5 py-0.5">
                      Temporada
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    {res.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                    {res.origen === 'web' ? 'Web' : 'Manual'}
                  </span>
                </td>
                <td className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Ver cliente</td>
              </tr>
            )
          }
          return (
            <tr key={res.id} className="hover:bg-white/5 transition-all group">
              <td className="px-6 py-5 text-gray-300 font-medium whitespace-nowrap">{formatFecha(fechaLlegada(res))}</td>
              <td className="px-6 py-5 font-bold text-white uppercase">
                {res.clientes?.nombre || 'S/N'}
                {coSocios(res).length > 0 && (
                  <p className="text-[10px] text-gray-500 font-normal normal-case tracking-widest mt-0.5">
                    Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                  </p>
                )}
              </td>
              <td className="px-6 py-5 font-medium text-gray-300 uppercase">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
              <td className="px-6 py-5 font-bold text-white"><MontoReserva reserva={res} /></td>
              <td className="px-6 py-5 font-bold text-red-400">
                {formatPesosVisible(res.saldo)}
              </td>
              <td className="px-6 py-5">
                <StatusBadge status={estadoBadgeStatus(res)} />
              </td>
              <td className="px-6 py-5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {res.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                  {res.origen === 'web' ? 'Web' : 'Manual'}
                </span>
              </td>
              <td className="px-6 py-5">
                <div className="flex gap-2">
                  {!res.bonificada && (
                    <button
                      onClick={() => setPagoReserva(res)}
                      disabled={Number(res.saldo) <= 0}
                      className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-green-400 transition-all"
                      title={Number(res.saldo) > 0 ? 'Registrar pago' : 'Sin saldo pendiente'}
                    >
                      <Wallet size={16} />
                    </button>
                  )}
                  <button onClick={() => handleOpenEdit(res)} className="p-2 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleCancelarClick(res)} className="p-2 hover:bg-orange-500/10 rounded-lg text-orange-400 transition-all" title="Cancelar reserva">
                    <XCircle size={16} />
                  </button>
                  <button onClick={() => handleEliminarClick(res)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all" title="Eliminar definitivamente">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )
        }}
        renderMobileCard={(res) => {
          if (res.tipo_alquiler === 'temporada') {
            return (
              <div onClick={() => navigate(linkToCliente(res.cliente_id))} className="cursor-pointer -m-5 p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formatFecha(fechaLlegada(res))}</p>
                    <h3 className="font-bold uppercase text-sm text-white truncate">{res.clientes?.nombre || 'S/N'}</h3>
                    <p className="text-[11px] text-gray-500 uppercase mt-0.5">
                      {unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}
                    </p>
                    {coSocios(res).length > 0 && (
                      <p className="text-[10px] text-gray-500 uppercase mt-0.5">
                        Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={estadoBadgeStatus(res)} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 border border-cyan-400/30 rounded px-1.5 py-0.5">
                      Temporada
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Saldo</p>
                    <p className="text-sm font-bold text-red-400">
                      {formatPesosVisible(res.saldo)}
                    </p>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ver cliente</p>
                </div>
              </div>
            )
          }
          return (
            <>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formatFecha(fechaLlegada(res))}</p>
                  <h3 className="font-bold uppercase text-sm text-white truncate">{res.clientes?.nombre || 'S/N'}</h3>
                  <p className="text-[11px] text-gray-500 uppercase mt-0.5">
                    {unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero} &bull; {res.tipo_alquiler}
                  </p>
                  {coSocios(res).length > 0 && (
                    <p className="text-[10px] text-gray-500 uppercase mt-0.5">
                      Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                    </p>
                  )}
                </div>
                <StatusBadge status={estadoBadgeStatus(res)} />
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Saldo</p>
                  <p className="text-sm font-bold text-red-400">
                    {formatPesosVisible(res.saldo)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!res.bonificada && (
                    <button
                      onClick={() => setPagoReserva(res)}
                      disabled={Number(res.saldo) <= 0}
                      className="p-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-green-400 transition-all"
                    >
                      <Wallet size={16} />
                    </button>
                  )}
                  <button onClick={() => handleOpenEdit(res)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleCancelarClick(res)} className="p-2.5 bg-white/5 hover:bg-orange-500/10 rounded-lg text-orange-400 transition-all">
                    <XCircle size={16} />
                  </button>
                  <button onClick={() => handleEliminarClick(res)} className="p-2.5 bg-white/5 hover:bg-red-500/10 rounded-lg text-red-400 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </>
          )
        }}
      />

      {/* Modal Form */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Seleccionar Cliente</label>
            <ClienteSelector
              value={clienteId}
              onChange={(id) => setClienteId(id)}
            />
          </div>

          {editingReserva && (
            <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                {bloqueada ? <Lock size={14} className="text-red-400" /> : <Unlock size={14} className="text-gray-500" />}
                {bloqueada ? 'Fecha y unidad bloqueadas' : 'Fecha y unidad editables'}
              </div>
              <button
                type="button"
                onClick={handleToggleBloqueada}
                className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                  bloqueada ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {bloqueada ? 'Desbloquear' : 'Bloquear'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad</label>
              <BrandSelect
                value={unidadId}
                onChange={setUnidadId}
                disabled={bloqueada}
                options={opcionesUnidad}
                invalid={conflictoFechas}
                searchable
                searchPlaceholder="Buscar unidad..."
              />
              {/* Unidades con temporada activa no aparecen en la lista; las de
                  período/día que se solapan con las fechas elegidas quedan
                  afuera también, salvo la ya seleccionada (se avisa acá). */}
              {conflictoFechas && (
                <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold">
                  Ocupada en esas fechas por otra reserva — elegí otra unidad o cambiá las fechas.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
              {/* Ya no es un input editable (Frente 2): la asigna sola el
                  trigger fn_reserva_asigna_temporada tomando la que tenga
                  estado='activa' — acá solo se informa cuál es. Al editar
                  una reserva vieja se muestra la que ya tenía, no la activa
                  de hoy (editar no debe migrarla de temporada). */}
              <p className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-300 text-sm font-bold">
                {editingReserva?.temporada || temporadaActiva?.nombre || '—'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tipo de alquiler</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'periodo', label: 'Período' },
                { key: 'dia', label: 'Día' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  disabled={bloqueada}
                  onClick={() => setTipoAlquiler(t.key)}
                  className={`py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    tipoAlquiler === t.key
                      ? 'bg-[#FDE047] text-black border-[#FDE047]'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">
              Temporada completa se carga desde el Directorio de Clientes.
            </p>
          </div>

          {tipoAlquiler === 'periodo' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fechas (Inicio — Fin)</label>
                <span className="text-xs font-bold text-[#FDE047]">
                  {fechaInicio || '—'} → {fechaFin || '—'}
                </span>
              </div>
              {!unidadId && (
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Elegí una unidad para ver sus días ocupados.</p>
              )}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-center">
                <ReservaCalendar
                  mode="range"
                  value={{ desde: fechaInicio, hasta: fechaFin }}
                  onChange={({ desde, hasta }) => {
                    setFechaInicio(desde)
                    setFechaFin(hasta)
                  }}
                  rangosOcupados={rangosOcupados}
                  disabled={bloqueada}
                />
              </div>
            </div>
          )}

          {tipoAlquiler === 'dia' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</label>
                <span className="text-xs font-bold text-[#FDE047]">{fecha || '—'}</span>
              </div>
              {!unidadId && (
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Elegí una unidad para ver sus días ocupados.</p>
              )}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-center">
                <ReservaCalendar mode="single" value={fecha} onChange={setFecha} rangosOcupados={rangosOcupados} disabled={bloqueada} />
              </div>
            </div>
          )}

          {puedeBonificar && (
            <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
              <label htmlFor="reserva-bonificada" className="text-[10px] font-bold text-gray-300 uppercase tracking-widest cursor-pointer">
                Unidad bonificada
              </label>
              <input
                id="reserva-bonificada"
                type="checkbox"
                checked={bonificada}
                onChange={(e) => setBonificada(e.target.checked)}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
          )}

          <MoneyInput
            label="Monto Total"
            value={bonificada ? 0 : valorTotal}
            onChange={setValorTotal}
            required
            disabled={bonificada}
            max={100_000_000}
            hint={bonificada ? 'Carpa bonificada: sin cargo, no registra pagos.' : undefined}
          />

          {/* Saldo y estado de pago ya no se cargan a mano: los recalcula el
              trigger fn_reserva_recalcula_saldo / fn_pago_actualiza_saldo a
              partir de valor_total/bonificada y los pagos registrados en
              `pagos`. */}
          {editingReserva && (
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saldo Pendiente</p>
                <p className={`text-lg font-bold ${Number(editingReserva.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {estaSaldada(editingReserva) ? 'Unidad saldada' : formatPesos(editingReserva.saldo)}
                </p>
              </div>
              <StatusBadge status={estadoBadgeStatus(editingReserva)} />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Notas</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none resize-none"
            />
          </div>

          {editingReserva && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Historial</p>
              <Historial tipo="reserva" id={editingReserva.id} compact />
            </div>
          )}

          <button type="submit" className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl">
            {editingReserva ? 'Guardar Cambios' : 'Confirmar Operación'}
          </button>
        </form>
      </Modal>

      {/* Registrar Pago (Tarea 4) — mismo componente que usa Clientes y el Plano */}
      <RegistrarPago
        isOpen={!!pagoReserva}
        onClose={() => setPagoReserva(null)}
        cliente={pagoReserva?.clientes}
        reservasOptions={pagoReserva ? [pagoReserva] : []}
        initialReservaId={pagoReserva?.id || ''}
        allowSinReserva={false}
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

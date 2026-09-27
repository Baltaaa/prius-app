import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatCurrency, formatDate, unidadEmoji, normalizeText } from '../../lib/format'
import { coSocios, estaSaldada, rangosOcupadosPorUnidad, estadoBadgeStatus } from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import { useDebounced } from '../../hooks/useDebounced'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import PagoModal from '../../components/crm/PagoModal'
import CurrencyInput from '../../components/crm/CurrencyInput'
import StatusBadge from '../../components/crm/StatusBadge'
import MontoReserva from '../../components/crm/MontoReserva'
import ReservaCalendar from '../../components/crm/ReservaCalendar'
import ConfirmDeleteModal from '../../components/crm/ConfirmDeleteModal'
import { Plus, Edit2, Trash2, XCircle, Search, Filter, Check, Wallet, Globe, MonitorSmartphone, UserPlus, X, Lock, Unlock } from 'lucide-react'

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

// Fecha de llegada de una reserva operativa: fecha_inicio para período, fecha para día.
const fechaLlegada = (r) => (r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_inicio) || r.created_at

export default function Reservas() {
  const { reservas, unidades, temporadaActiva, loading: resLoading, createReserva, updateReserva, deleteReserva, cancelarReserva } = useReservas()
  const { clientes, loading: cliLoading, createCliente } = useClientes()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirm, alert } = useDialog()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [pagoReserva, setPagoReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtroUnidadId, setFiltroUnidadId] = useState(null) // deep-link "Ver todas" desde el modal de unidad del Plano

  // Form state
  const [clienteId, setClienteId] = useState('')
  // Texto del combobox de cliente — separado de clienteId porque mientras se
  // está escribiendo/filtrando todavía no hay un cliente elegido.
  const [clienteInputValue, setClienteInputValue] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
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

  // Alta de cliente nuevo sin salir del modal de reserva (sep 2026): el
  // cliente se crea de una, apenas se toca "Guardar cliente" — no se difiere
  // al submit de la reserva. Así, si después se cancela la reserva, el
  // cliente igual quedó guardado en la base (no depende del resto del form).
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('')
  const [nuevoClienteMail, setNuevoClienteMail] = useState('')
  const [nuevoClienteCuit, setNuevoClienteCuit] = useState('')
  const [savingNuevoCliente, setSavingNuevoCliente] = useState(false)

  const resetNuevoClienteForm = () => {
    setShowNuevoCliente(false)
    setNuevoClienteNombre('')
    setNuevoClienteTelefono('')
    setNuevoClienteMail('')
    setNuevoClienteCuit('')
  }

  const resetForm = () => {
    setClienteId('')
    setClienteInputValue('')
    setShowClienteDropdown(false)
    setUnidadId('')
    setTipoAlquiler('periodo')
    setFechaInicio('')
    setFechaFin('')
    setFecha('')
    setValorTotal(0)
    setNotas('')
    setBloqueada(false)
    setBonificada(false)
    resetNuevoClienteForm()
  }

  const handleGuardarClienteInline = async () => {
    if (!nuevoClienteNombre.trim()) return
    setSavingNuevoCliente(true)
    try {
      const nuevo = await createCliente({
        nombre: nuevoClienteNombre.trim().toUpperCase(),
        telefono: nuevoClienteTelefono || null,
        mail: nuevoClienteMail || null,
        cuit: nuevoClienteCuit || null,
      })
      setClienteId(nuevo.id)
      setClienteInputValue(nuevo.nombre)
      resetNuevoClienteForm()
    } catch (err) {
      await alert('No se pudo crear el cliente.')
    } finally {
      setSavingNuevoCliente(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingReserva(null)
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (res) => {
    setEditingReserva(res)
    resetNuevoClienteForm()
    setClienteId(res.cliente_id || '')
    setClienteInputValue(res.clientes?.nombre || '')
    setShowClienteDropdown(false)
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
    // El <select> de cliente se reemplaza por el form inline mientras se está
    // creando uno nuevo (sin `required` en el DOM en ese momento) — se valida
    // acá para no dejar pasar una reserva sin cliente_id.
    if (showNuevoCliente || !clienteId) {
      await alert('Seleccioná un cliente o guardá el cliente nuevo antes de continuar.')
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
      // suma de `pagos`) — ver PagoModal / usePagos.
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

  // Deep-link desde la búsqueda global del TopBar: /app/reservas?id=<uuid>
  // abre directo el modal de edición de esa reserva.
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id || resLoading || cliLoading) return
    const res = reservas.find((r) => r.id === id)
    if (res) handleOpenEdit(res)
    setSearchParams({}, { replace: true })
  }, [searchParams, reservas, resLoading, cliLoading])

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
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, resLoading, cliLoading])

  // Deep-link "Ver todas" desde el Historial de la temporada del modal de
  // unidad del Plano: /app/reservas?filtroUnidad=<uuid> — filtra la cola por
  // esa unidad (solo período/día; temporada vive en Clientes).
  useEffect(() => {
    const unidad = searchParams.get('filtroUnidad')
    if (!unidad) return
    setFiltroUnidadId(unidad)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const debouncedSearch = useDebounced(searchTerm)

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
    const base = filtroUnidadId ? [...reservasOperativas, ...temporadasDeUnidadFiltrada] : reservasOperativas
    return base
      .filter((r) => {
        const matchesSearch =
          !term ||
          r.clientes?.nombre?.toLowerCase().includes(term) ||
          String(r.unidades?.numero ?? '').includes(term)
        const matchesEstado = filtroEstado === 'todos' || r.estado_pago === filtroEstado
        const matchesTipo = filtroTipo === 'todos' || r.tipo_alquiler === filtroTipo
        const matchesUnidad = !filtroUnidadId || r.unidad_id === filtroUnidadId
        const llegada = fechaLlegada(r)
        const matchesDesde = !desde || (llegada && llegada >= desde)
        const matchesHasta = !hasta || (llegada && llegada <= hasta)
        return matchesSearch && matchesEstado && matchesTipo && matchesUnidad && matchesDesde && matchesHasta
      })
      // Llegadas más recientes primero.
      .sort((a, b) => (fechaLlegada(b) || '').localeCompare(fechaLlegada(a) || ''))
  }, [reservasOperativas, temporadasDeUnidadFiltrada, debouncedSearch, filtroEstado, filtroTipo, filtroUnidadId, desde, hasta])

  const filtrosActivos = filtroEstado !== 'todos' || filtroTipo !== 'todos' || desde || hasta

  // Unidad del filtro deep-link, solo para mostrar el chip con su nombre.
  const unidadFiltrada = filtroUnidadId ? unidades.find((u) => u.id === filtroUnidadId) : null

  const headers = ['Llegada', 'Cliente', 'Unidad', 'Monto Total', 'Saldo', 'Estado', 'Origen', 'Acciones']

  // Combobox de cliente: filtra por nombre a medida que se escribe, sin
  // acentos/mayúsculas — "+ Añadir cliente nuevo" siempre queda al final.
  const clientesFiltrados = useMemo(() => {
    const term = normalizeText(clienteInputValue).trim()
    const lista = term ? clientes.filter((c) => normalizeText(c.nombre).includes(term)) : clientes
    return lista.slice(0, 8)
  }, [clientes, clienteInputValue])

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
        <div className="flex-1 min-w-[160px] relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por cliente o unidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-[#FDE047]/50 rounded-xl outline-none text-white text-sm transition-all"
          />
        </div>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-[#FDE047]/50 outline-none [color-scheme:dark]"
          title="Llegada desde"
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:border-[#FDE047]/50 outline-none [color-scheme:dark]"
          title="Llegada hasta"
        />
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

      {unidadFiltrada && (
        <button
          onClick={() => setFiltroUnidadId(null)}
          className="inline-flex items-center gap-2 bg-[#FDE047]/10 border border-[#FDE047]/30 text-[#FDE047] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#FDE047]/20 transition-all"
          title="Quitar filtro de unidad"
        >
          {unidadEmoji(unidadFiltrada.tipo)} {unidadFiltrada.tipo} #{unidadFiltrada.numero} <X size={12} />
        </button>
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
                onClick={() => navigate(`/app/clientes?id=${res.cliente_id}`)}
                className="hover:bg-white/5 transition-all group cursor-pointer"
              >
                <td className="px-6 py-5 text-gray-300 font-medium whitespace-nowrap">{formatDate(fechaLlegada(res))}</td>
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
                <td className={`px-6 py-5 font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(res.saldo)}
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
              <td className="px-6 py-5 text-gray-300 font-medium whitespace-nowrap">{formatDate(fechaLlegada(res))}</td>
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
              <td className={`px-6 py-5 font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(res.saldo)}
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
              <div onClick={() => navigate(`/app/clientes?id=${res.cliente_id}`)} className="cursor-pointer -m-5 p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formatDate(fechaLlegada(res))}</p>
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
                    <p className={`text-sm font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(res.saldo)}
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
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formatDate(fechaLlegada(res))}</p>
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
                  <p className={`text-sm font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(res.saldo)}
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
            {!showNuevoCliente ? (
              <div className="relative">
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Buscar cliente por nombre..."
                  value={clienteInputValue}
                  onChange={(e) => {
                    setClienteInputValue(e.target.value)
                    setClienteId('')
                    setShowClienteDropdown(true)
                  }}
                  onFocus={(e) => {
                    setShowClienteDropdown(true)
                    e.target.select()
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold"
                />
                {showClienteDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowClienteDropdown(false)} />
                    <div className="absolute left-0 right-0 mt-2 glass-card rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
                      {clientesFiltrados.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-500 uppercase tracking-widest">Sin resultados</p>
                      ) : (
                        clientesFiltrados.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setClienteId(c.id)
                              setClienteInputValue(c.nombre)
                              setShowClienteDropdown(false)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all uppercase font-bold"
                          >
                            {c.nombre}
                          </button>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowNuevoCliente(true)
                          setShowClienteDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#FDE047] hover:bg-white/10 transition-all font-bold border-t border-white/10 flex items-center gap-2"
                      >
                        <UserPlus size={14} /> Añadir cliente nuevo
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-white/5 border border-[#FDE047]/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-[#FDE047] uppercase tracking-widest">Cliente Nuevo</p>
                  <button
                    type="button"
                    onClick={resetNuevoClienteForm}
                    className="text-gray-500 hover:text-white transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Nombre completo"
                  value={nuevoClienteNombre}
                  onChange={(e) => setNuevoClienteNombre(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    placeholder="Teléfono"
                    value={nuevoClienteTelefono}
                    onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold"
                  />
                  <input
                    type="text"
                    placeholder="CUIT / DNI"
                    value={nuevoClienteCuit}
                    onChange={(e) => setNuevoClienteCuit(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold"
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={nuevoClienteMail}
                  onChange={(e) => setNuevoClienteMail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#FDE047]/50 outline-none lowercase font-bold"
                />
                <button
                  type="button"
                  onClick={handleGuardarClienteInline}
                  disabled={!nuevoClienteNombre.trim() || savingNuevoCliente}
                  className="w-full py-2.5 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={14} /> {savingNuevoCliente ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            )}
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
              <select
                required
                disabled={bloqueada}
                value={unidadId}
                onChange={(e) => setUnidadId(e.target.value)}
                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm outline-none uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                  conflictoFechas ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#FDE047]/50'
                }`}
              >
                <option value="" disabled>Seleccionar...</option>
                {unidadesDisponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {unidadEmoji(u.tipo)} {u.tipo} #{u.numero}
                    {u.id === unidadId && conflictoFechas ? ' (ocupada esas fechas)' : ''}
                  </option>
                ))}
              </select>
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

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
            <CurrencyInput
              value={bonificada ? 0 : valorTotal}
              onChange={setValorTotal}
              required
              disabled={bonificada}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {bonificada && (
              <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">
                Carpa bonificada: sin cargo, no registra pagos.
              </p>
            )}
          </div>

          {/* Saldo y estado de pago ya no se cargan a mano: los recalcula el
              trigger fn_reserva_recalcula_saldo / fn_pago_actualiza_saldo a
              partir de valor_total/bonificada y los pagos registrados en
              `pagos`. */}
          {editingReserva && (
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saldo Pendiente</p>
                <p className={`text-lg font-bold ${Number(editingReserva.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {estaSaldada(editingReserva) ? 'Unidad saldada' : formatCurrency(editingReserva.saldo)}
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

          <button type="submit" className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl">
            {editingReserva ? 'Guardar Cambios' : 'Confirmar Operación'}
          </button>
        </form>
      </Modal>

      {/* Pago Modal (Fase 2) — mismo componente/hook que usa Clientes */}
      <PagoModal
        isOpen={!!pagoReserva}
        onClose={() => setPagoReserva(null)}
        reservasOptions={pagoReserva ? [pagoReserva] : []}
        initialReservaId={pagoReserva?.id || ''}
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

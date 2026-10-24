import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatPesos, formatPesosVisible, formatFecha, formatRangoFechas, unidadEmoji } from '../../lib/format'
import DateInput from '../../components/inputs/DateInput'
import BrandSelect from '../../components/ui/BrandSelect'
import { coSocios, estaSaldada, rangosOcupadosPorUnidad, estadoBadgeStatus } from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import LoadingButton from '../../components/ui/LoadingButton'
import { usePermiso } from '../../context/AuthProvider'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { useOverlay } from '../../context/OverlayProvider'
import { registrarVisto } from '../../hooks/useRecientes'
import { linkToCliente, linkToComprobante, linkToRecepcion } from '../../lib/deepLinks'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import RegistrarPago from '../../components/crm/RegistrarPago'
import PagoComprobanteCampos from '../../components/crm/PagoComprobanteCampos'
import { usePagoComprobanteForm } from '../../hooks/usePagoComprobanteForm'
import DetallePago from '../../components/crm/DetallePago'
import MoneyInput from '../../components/inputs/MoneyInput'
import ClienteSelector from '../../components/crm/ClienteSelector'
import StatusBadge from '../../components/crm/StatusBadge'
import MontoReserva from '../../components/crm/MontoReserva'
import ReservaCalendar from '../../components/crm/ReservaCalendar'
import Historial from '../../components/crm/Historial'
import ConfirmDeleteModal from '../../components/crm/ConfirmDeleteModal'
import { useMountTransition } from '../../hooks/useMountTransition'
import { useRevealOnCheck } from '../../hooks/useRevealOnCheck'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'
import ReservaDetalleContent from '../../components/crm/ReservaDetalleContent'
import ReservaListaMobile from '../../components/crm/ReservaListaMobile'
import BottomSheet from '../../components/ui-prius/BottomSheet'
import { Plus, Filter, Check, Globe, MonitorSmartphone, X, Lock, Unlock, ChevronDown, ChevronLeft, LayoutList } from 'lucide-react'

// Título chico de sección dentro del modal de reserva (Tarea 5, oct 2026) —
// mismo patrón repetido en ambas columnas, separador en vez de mayúscula de
// borde de color (Glass Dark no usa #E5E5E5 literal, ver CLAUDE.md).
function SeccionTitulo({ children }) {
  return (
    <p className="text-[9px] font-bold text-prius-muted uppercase tracking-[0.2em] border-b border-hairline pb-2">
      {children}
    </p>
  )
}

// Días (inclusivos) de una reserva período/día, para el resumen fijo del
// modal — solo display, no se guarda ni valida nada con este número. 27/12
// al 09/01 son 14 días, no 13: por eso el +1 de abajo (balneario, no hotel
// — nunca "noches", Tarea 2 oct 2026).
function diasEntre(desdeIso, hastaIso) {
  if (!desdeIso || !hastaIso) return null
  const [y1, m1, d1] = desdeIso.split('-').map(Number)
  const [y2, m2, d2] = hastaIso.split('-').map(Number)
  const ms = new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)
  return Math.round(ms / 86400000) + 1
}

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
  const { reservas, unidades, temporadas, temporadaActiva, loading: resLoading, crearReservaConPago, updateReserva, deleteReserva, cancelarReserva } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()
  const readyReservas = useInitialLoad(resLoading || cliLoading)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirm, alert, toast } = useDialog()
  const puedeBonificar = usePermiso('bonificar')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [masOpcionesAbierto, setMasOpcionesAbierto] = useState(false) // "Más opciones" del modal de reserva (Tarea 5): notas + historial, cerrado por defecto
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
  // Alta all-in-one (item 3, oct 2026): el primer pago (seña o total) con
  // su comprobante se carga sí o sí en el mismo modal — ya no hay checkbox
  // "cargar un pago ahora" ni un RegistrarPago encadenado después. Única
  // excepción: "Cargar más tarde", que oculta la sección y crea la reserva
  // sin pago (como siempre). Solo tiene sentido en alta nueva, nunca al
  // editar (ahí ya existe "Registrar pago" desde la ficha).
  const [cargarMasTarde, setCargarMasTarde] = useState(false)
  const revealPagoInicialRef = useRevealOnCheck(!cargarMasTarde)
  // Wizard mobile (<768px, mock 03-reservas-mobile-nueva): mismos 3 campos
  // reales del form de siempre (Cliente / Unidad+Fechas / Monto+resumen),
  // solo se muestran de a uno con Siguiente/Atrás — desktop/tablet siguen
  // viendo el form de dos columnas completo, sin pasos. Nunca se inventan
  // campos de personas ni precio por método de pago (no existen en este
  // flujo, ver auditoría previa).
  const [mobileStep, setMobileStep] = useState(0)
  const MOBILE_STEPS = ['Cliente', 'Unidad y fechas', 'Monto']

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
    setCargarMasTarde(false)
  }

  // Snapshot del form al abrir (Tarea 1, oct 2026) — para que el Modal
  // pueda preguntar "¿hay cambios sin guardar?" antes de cerrar por click
  // afuera o Escape. Se compara contra los valores actuales en `isDirty`.
  const formSnapshotRef = useRef('')
  const snapshotForm = (f) => JSON.stringify(f)

  const handleOpenCreate = () => {
    setEditingReserva(null)
    resetForm()
    setMasOpcionesAbierto(false)
    setMobileStep(0)
    setIsModalOpen(true)
    formSnapshotRef.current = snapshotForm({
      clienteId: '', unidadId: '', tipoAlquiler: 'periodo', fechaInicio: '', fechaFin: '',
      fecha: '', valorTotal: 0, notas: '', bloqueada: false, bonificada: false,
    })
  }

  const handleOpenEdit = (res) => {
    registrarVisto('reserva', res.id) // [feat-4]
    setMasOpcionesAbierto(false)
    setMobileStep(0)
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
    formSnapshotRef.current = snapshotForm({
      clienteId: res.cliente_id || '', unidadId: res.unidad_id || '', tipoAlquiler: res.tipo_alquiler || 'periodo',
      fechaInicio: res.fecha_inicio || '', fechaFin: res.fecha_fin || '', fecha: res.fecha || '',
      valorTotal: res.valor_total ?? 0, notas: res.notas || '', bloqueada: res.bloqueada || false, bonificada: res.bonificada || false,
    })
  }

  const isFormDirty = () => snapshotForm({
    clienteId, unidadId, tipoAlquiler, fechaInicio, fechaFin, fecha, valorTotal, notas, bloqueada, bonificada,
  }) !== formSnapshotRef.current || Number(pagoForm.monto) > 0 || !!pagoForm.numero

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

  const [savingReserva, setSavingReserva] = useState(false)

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
    // Item 3 (oct 2026): el primer pago es obligatorio salvo bonificada o
    // "Cargar más tarde" — se valida acá antes de disparar la transacción
    // (el botón ya se deshabilita por esto, ver disabled del submit).
    const requierePago = !editingReserva && !bonificada && !cargarMasTarde
    if (requierePago) {
      if (Number(pagoForm.monto) <= 0) {
        await alert('Cargá el monto del primer pago, o tildá "Cargar más tarde".')
        return
      }
      if (pagoForm.excedeSaldo) {
        await alert(`El monto supera el total de la reserva (${formatPesos(valorTotal)}).`)
        return
      }
      if (pagoForm.comprobanteIncompleto) {
        await alert('El comprobante del primer pago es obligatorio: completá tipo, número y fecha.')
        return
      }
      if (pagoForm.duplicado) {
        await alert('Ese número de comprobante ya está cargado en otro pago.')
        return
      }
    }

    setSavingReserva(true)
    try {
      if (editingReserva) {
        await updateReserva(editingReserva.id, payload)
        setIsModalOpen(false)
        toast('Reserva actualizada con éxito', { tone: 'success' })
      } else {
        const pagoPayload = requierePago ? {
          cliente_id: clienteId,
          monto: pagoForm.monto,
          medio: pagoForm.medio,
          tipo_pago: pagoForm.tipoPago || 'parcial',
          concepto: pagoForm.concepto,
          referencia: pagoForm.referencia,
          comprobante: pagoForm.construirComprobantePayload(),
          fecha: pagoForm.fechaComprobante,
        } : null
        // Reserva + pago en una sola transacción (fn_crear_reserva_con_pago):
        // si el pago falla, la reserva no queda creada — ver DataProvider.
        await crearReservaConPago({ reserva: payload, pago: pagoPayload })
        setIsModalOpen(false)
        toast(pagoPayload ? 'Reserva y pago registrados' : 'Reserva creada con éxito', { tone: 'success' })
      }
    } catch (err) {
      toast(err.message || 'Error guardando la reserva.', { tone: 'error' })
    } finally {
      setSavingReserva(false)
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

  // [feat-2] Deep-link desde "Nueva reserva" en la fila de un cliente
  // (Clientes.jsx): /app/reservas?cliente=<uuid> — abre el alta con el
  // cliente ya elegido.
  useEffect(() => {
    const cliente = searchParams.get('cliente')
    if (!cliente || searchParams.get('id') || searchParams.get('unidad') || resLoading || cliLoading) return
    handleOpenCreate()
    setClienteId(cliente)
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
  // nada que chequear (se habilita a medida que se completan). Item 3 (fix
  // urgente oct 2026): con tipoAlquiler='temporada' no hay date picker —
  // el rango candidato es la temporada vigente completa
  // (temporadaActiva.fecha_inicio/fecha_fin), única fuente de verdad ya
  // usada en toda la app (ver `temporadas`, CLAUDE.md "Estructura de datos").
  const unidadTieneConflictoDeFechas = (unidadId) => {
    const candStart = tipoAlquiler === 'dia' ? fecha : tipoAlquiler === 'temporada' ? temporadaActiva?.fecha_inicio : fechaInicio
    const candEnd = tipoAlquiler === 'dia' ? fecha : tipoAlquiler === 'temporada' ? temporadaActiva?.fecha_fin : fechaFin
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
    [unidades, unidadesBloqueadasPorTemporada, unidadId, tipoAlquiler, fechaInicio, fechaFin, fecha, reservas, editingReserva, temporadaActiva],
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

  // Item 3 (oct 2026): mismo bloque de campos (monto/medio/comprobante) que
  // Registrar Pago, inline acá — la reserva todavía no existe, así que
  // total=saldo=valorTotal y pagado=0 (nada cobrado todavía). `resetKey`
  // cambia cada vez que se abre el modal en modo alta, para arrancar en
  // blanco cada vez (nunca al editar, ahí no se usa esta sección).
  const unidadSeleccionadaLabel = opcionesUnidad.find((o) => o.value === unidadId)?.label || ''
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null
  const pagoForm = usePagoComprobanteForm({
    resetKey: isModalOpen && !editingReserva ? 'nueva-reserva-abierta' : 'cerrado',
    cliente: clienteSeleccionado,
    reservaInfo: {
      total: bonificada ? 0 : Number(valorTotal || 0),
      saldo: bonificada ? 0 : Number(valorTotal || 0),
      saldoDesconocido: false,
      pagado: 0,
      unidadLabel: unidadSeleccionadaLabel,
      temporadaOTipo: tipoAlquiler === 'temporada' ? temporadaActiva?.nombre : tipoAlquiler,
      sinReserva: false,
    },
  })

  // Días ya ocupados por otra reserva período/día de la unidad elegida, para
  // tacharlos/bloquearlos en el date picker del form (Tarea 7) — misma regla
  // que el exclusion constraint de la base, ver lib/reservas.js.
  const rangosOcupados = useMemo(
    () => rangosOcupadosPorUnidad(reservas, unidadId, editingReserva?.id),
    [reservas, unidadId, editingReserva],
  )

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
        <button
          onClick={handleOpenCreate}
          className="bg-gold hover:bg-gold-hover text-black px-6 py-3 min-h-[44px] rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl shrink-0 md:ml-auto"
        >
          <Plus size={18} /> Nueva Reserva
        </button>
      </div>

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
                <td className="px-6 py-5 text-prius-slate font-medium whitespace-nowrap">{formatFecha(fechaLlegada(res))}</td>
                <td className="px-6 py-5 font-bold text-black uppercase">
                  {res.clientes?.nombre || 'S/N'}
                  {coSocios(res).length > 0 && (
                    <p className="text-[10px] text-prius-muted font-normal normal-case tracking-widest mt-0.5">
                      Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-6 py-5 font-medium text-prius-slate uppercase">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-6 py-5 font-bold text-black"><MontoReserva reserva={res} /></td>
                <td className="px-6 py-5 font-bold text-prius-error">
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
              <td className="px-6 py-5 text-prius-slate font-medium whitespace-nowrap">{formatFecha(fechaLlegada(res))}</td>
              <td className="px-6 py-5 font-bold text-black uppercase">
                {res.clientes?.nombre || 'S/N'}
                {coSocios(res).length > 0 && (
                  <p className="text-[10px] text-prius-muted font-normal normal-case tracking-widest mt-0.5">
                    Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}
                  </p>
                )}
              </td>
              <td className="px-6 py-5 font-medium text-prius-slate uppercase">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
              <td className="px-6 py-5 font-bold text-black"><MontoReserva reserva={res} /></td>
              <td className="px-6 py-5 font-bold text-prius-error">
                {formatPesosVisible(res.saldo)}
              </td>
              <td className="px-6 py-5">
                <StatusBadge status={estadoBadgeStatus(res)} />
              </td>
              <td className="px-6 py-5">
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

          {/* Panel fijo — solo ≥1024px. */}
          <aside className="hidden lg:flex w-96 shrink-0 card-light rounded-2xl p-space-lg flex-col overflow-hidden sticky top-4 self-start max-h-[calc(100vh-2rem)]">
            {selectedReserva ? (
              <ReservaDetalleContent
                reserva={selectedReserva}
                fechaLlegada={fechaLlegada}
                onClose={handleCloseDetalle}
                onRegistrarPago={setPagoReserva}
                onEditar={handleOpenEdit}
                onCancelar={handleCancelarClick}
                onEliminar={handleEliminarClick}
                onCellClick={(res, pago) => setPagoDetalle({ reserva: res, pago })}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-prius-muted">
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
              onEditar={handleOpenEdit}
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
              onEditar={handleOpenEdit}
              onCancelar={handleCancelarClick}
              onEliminar={handleEliminarClick}
              onCellClick={(res, pago) => setPagoDetalle({ reserva: res, pago })}
              showCloseButton={false}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* Modal Form */}
      {/* Rediseño Tarea 5 (oct 2026): solo JSX/layout — mismo state, mismos
          handlers, mismo orden de escritura que antes. Dos columnas en
          desktop (cliente/unidad/fechas a la izquierda, precio/resumen a la
          derecha) para que entre completo en 1366x768 sin scroll o con
          scroll interno mínimo; el submit real sigue siendo el <form>, el
          botón vive en el footer sticky del Modal vía el atributo HTML
          `form` (mismo handleSubmit, nada cambia de la lógica). */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}
        isDirty={isFormDirty}
        maxWidthClass="sm:max-w-4xl"
        footer={
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest">Total</p>
              <p className="text-lg font-bold text-black">{formatPesos(bonificada ? 0 : valorTotal)}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => (isMobile && mobileStep > 0 ? setMobileStep((s) => s - 1) : setIsModalOpen(false))}
                className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-prius-slate bg-prius-subtle hover:bg-prius-subtle border border-hairline transition-all"
              >
                {isMobile && mobileStep > 0 ? 'Atrás' : 'Cancelar'}
              </button>
              {isMobile && mobileStep < MOBILE_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setMobileStep((s) => s + 1)}
                  className="px-6 py-3 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
                >
                  Siguiente
                </button>
              ) : (
                <LoadingButton
                  type="submit"
                  form="form-reserva"
                  loading={savingReserva}
                  loadingText="Guardando..."
                  disabled={
                    !editingReserva && !bonificada && !cargarMasTarde
                    && (Number(pagoForm.monto) <= 0 || pagoForm.excedeSaldo || pagoForm.comprobanteIncompleto || !!pagoForm.duplicado)
                  }
                  className="px-6 py-3 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs shadow-xl"
                >
                  {editingReserva ? 'Guardar Cambios' : 'Crear reserva'}
                </LoadingButton>
              )}
            </div>
          </div>
        }
      >
        <form id="form-reserva" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Indicador de paso (mobile, <768px, mock 03-reservas-mobile-nueva)
              — mismos 3 campos reales del form de siempre, no los 5 pasos
              inventados del mock (sin personas ni precio por método de
              pago, ver auditoría). Desktop/tablet no muestran esto: todo el
              form entra de una vez, como siempre. */}
          {isMobile && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gold uppercase tracking-widest">
                  Paso {mobileStep + 1} de {MOBILE_STEPS.length}
                </span>
                <span className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">{MOBILE_STEPS[mobileStep]}</span>
              </div>
              <div className="h-1 rounded-full bg-prius-subtle overflow-hidden flex gap-0.5">
                {MOBILE_STEPS.map((s, i) => (
                  <div key={s} className={`flex-1 rounded-full ${i <= mobileStep ? 'bg-gold' : 'bg-hairline'}`} />
                ))}
              </div>
            </div>
          )}

          {/* Columna izquierda: quién, dónde, cuándo. En mobile, cada
              sub-bloque se oculta según `mobileStep` (0=Cliente,
              1=Unidad y fechas) sin romper la columna única de desktop. */}
          <div className="space-y-5">
            <div className={isMobile && mobileStep !== 0 ? 'hidden' : 'space-y-5'}>
            <SeccionTitulo>{isMobile ? 'Cliente' : 'Cliente y unidad'}</SeccionTitulo>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Seleccionar Cliente</label>
              <ClienteSelector
                value={clienteId}
                onChange={(id) => setClienteId(id)}
              />
            </div>

            {editingReserva && (
              <div className="flex items-center justify-between p-3 bg-prius-subtle border border-hairline rounded-xl">
                <div className="flex items-center gap-2 text-[10px] text-prius-slate uppercase tracking-widest font-bold">
                  {bloqueada ? <Lock size={14} className="text-prius-error" /> : <Unlock size={14} className="text-prius-muted" />}
                  {bloqueada ? 'Fecha y unidad bloqueadas' : 'Fecha y unidad editables'}
                </div>
                <button
                  type="button"
                  onClick={handleToggleBloqueada}
                  className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                    bloqueada ? 'bg-red-500/10 text-prius-error hover:bg-red-500/20' : 'bg-prius-subtle text-prius-slate hover:text-black'
                  }`}
                >
                  {bloqueada ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
            )}
            </div>

            <div className={isMobile && mobileStep !== 1 ? 'hidden' : 'space-y-5'}>
            {isMobile && <SeccionTitulo>Unidad y fechas</SeccionTitulo>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Unidad</label>
                <BrandSelect
                  value={unidadId}
                  onChange={setUnidadId}
                  disabled={bloqueada}
                  options={opcionesUnidad}
                  invalid={conflictoFechas}
                  searchable
                  searchPlaceholder="Buscar unidad..."
                />
                {conflictoFechas && (
                  <p className="text-[10px] text-prius-error uppercase tracking-widest font-bold">
                    Ocupada en esas fechas — elegí otra unidad o cambiá las fechas.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Temporada</label>
                <p className="w-full h-9 flex items-center bg-prius-subtle border border-hairline rounded-xl px-4 text-prius-slate text-sm font-bold truncate">
                  {editingReserva?.temporada || temporadaActiva?.nombre || '—'}
                </p>
              </div>
            </div>

            <SeccionTitulo>Fechas</SeccionTitulo>

            <div className="space-y-2">
              {/* Item 3 (fix urgente oct 2026): se agrega Temporada, orden
                  Temporada/Período/Día. Solo en alta nueva — editar una
                  reserva de temporada sigue viviendo en Clientes (el
                  deep-link de edición ya redirige para allá, ver
                  useDeepLinkTarget más abajo). */}
              <div className={`grid gap-2 ${editingReserva ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {[
                  ...(editingReserva ? [] : [{ key: 'temporada', label: 'Temporada' }]),
                  { key: 'periodo', label: 'Período' },
                  { key: 'dia', label: 'Día' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    disabled={bloqueada}
                    onClick={() => setTipoAlquiler(t.key)}
                    className={`h-9 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      tipoAlquiler === t.key
                        ? 'bg-gold text-black border-gold'
                        : 'bg-prius-subtle text-prius-slate border-hairline hover:text-black'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tipoAlquiler === 'temporada' && (
                <p className="text-[9px] text-prius-muted uppercase tracking-widest">
                  Se asigna toda la temporada vigente ({temporadaActiva?.nombre || '—'}), sin elegir fechas.
                </p>
              )}
            </div>

            {tipoAlquiler === 'temporada' && (
              <div className="space-y-2">
                <div className="bg-prius-subtle border border-hairline rounded-xl p-4 text-center">
                  <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest">Temporada vigente</p>
                  <p className="text-sm font-bold text-black mt-1">{temporadaActiva?.nombre || '—'}</p>
                </div>
                {unidadId && conflictoFechas && (
                  <p className="text-[11px] text-prius-error">
                    Esa unidad ya tiene una reserva de período o día dentro de esta temporada — no se puede asignar toda la temporada. Elegí otra unidad.
                  </p>
                )}
              </div>
            )}

            {tipoAlquiler === 'periodo' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fechas (Inicio — Fin)</label>
                  <span className="text-xs font-bold text-gold">
                    {fechaInicio || '—'} → {fechaFin || '—'}
                  </span>
                </div>
                {!unidadId && (
                  <p className="text-[10px] text-prius-muted uppercase tracking-widest">Elegí una unidad para ver sus días ocupados.</p>
                )}
                <div className="bg-prius-subtle border border-hairline rounded-xl p-3 flex justify-center">
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
                  <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fecha</label>
                  <span className="text-xs font-bold text-gold">{fecha || '—'}</span>
                </div>
                {!unidadId && (
                  <p className="text-[10px] text-prius-muted uppercase tracking-widest">Elegí una unidad para ver sus días ocupados.</p>
                )}
                <div className="bg-prius-subtle border border-hairline rounded-xl p-3 flex justify-center">
                  <ReservaCalendar mode="single" value={fecha} onChange={setFecha} rangosOcupados={rangosOcupados} disabled={bloqueada} />
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Columna derecha: precio, resumen, extras (mobile: paso 2) */}
          <div className={isMobile && mobileStep !== 2 ? 'hidden' : 'space-y-5'}>
            <SeccionTitulo>Precio y pago</SeccionTitulo>

            {puedeBonificar && (
              <div className="flex items-center justify-between p-3 bg-prius-subtle border border-hairline rounded-xl">
                <label htmlFor="reserva-bonificada" className="text-[10px] font-bold text-prius-slate uppercase tracking-widest cursor-pointer">
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
              <div className="flex items-center justify-between p-4 bg-prius-subtle border border-hairline rounded-xl">
                <div>
                  <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Saldo Pendiente</p>
                  <p className={`text-lg font-bold ${Number(editingReserva.saldo) > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                    {estaSaldada(editingReserva) ? 'Unidad saldada' : formatPesos(editingReserva.saldo)}
                  </p>
                </div>
                <StatusBadge status={estadoBadgeStatus(editingReserva)} />
              </div>
            )}

            {/* Resumen fijo: unidad, fechas, días, total, saldo — todo lo
                que ya se eligió a la izquierda, de un vistazo antes de
                confirmar. Balneario, no hotel: siempre "días" (Tarea 2,
                oct 2026), nunca "noches". */}
            <div className="p-4 bg-prius-subtle border border-gold/20 rounded-xl space-y-2">
              <p className="text-[9px] font-bold text-gold uppercase tracking-[0.2em]">Resumen</p>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-prius-muted uppercase tracking-widest">Unidad</span>
                <span className="text-black font-bold text-right truncate">
                  {opcionesUnidad.find((o) => o.value === unidadId)?.label || '—'}
                </span>
                <span className="text-prius-muted uppercase tracking-widest">Fechas</span>
                <span className="text-black font-bold text-right truncate">
                  {tipoAlquiler === 'temporada'
                    ? temporadaActiva?.nombre || '—'
                    : tipoAlquiler === 'dia' ? (fecha ? formatFecha(fecha) : '—') : (fechaInicio && fechaFin ? formatRangoFechas(fechaInicio, fechaFin) : '—')}
                </span>
                <span className="text-prius-muted uppercase tracking-widest">Días</span>
                <span className="text-black font-bold text-right">
                  {tipoAlquiler === 'temporada'
                    ? 'Temporada completa'
                    : tipoAlquiler === 'dia' ? (fecha ? 1 : '—') : (diasEntre(fechaInicio, fechaFin) ?? '—')}
                </span>
                <span className="text-prius-muted uppercase tracking-widest">Total</span>
                <span className="text-black font-bold text-right">{formatPesos(bonificada ? 0 : valorTotal)}</span>
                <span className="text-prius-muted uppercase tracking-widest">Saldo</span>
                <span className={`font-bold text-right ${editingReserva && Number(editingReserva.saldo) > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                  {editingReserva ? (estaSaldada(editingReserva) ? 'Saldado' : formatPesos(editingReserva.saldo)) : '—'}
                </span>
              </div>
            </div>

            {/* Item 3 (oct 2026): el primer pago (seña o total) con su
                comprobante va siempre acá, inline y obligatorio — nunca más
                un RegistrarPago encadenado después de crear la reserva.
                Única excepción: "Cargar más tarde". Solo en alta nueva,
                nunca al editar (ahí ya existe "Registrar pago" desde la
                ficha), y nunca si la unidad es bonificada (no admite pagos). */}
            {!editingReserva && !bonificada && (
              <div className="space-y-4">
                {!cargarMasTarde && (
                  <div ref={revealPagoInicialRef} className="animate-premium-fade">
                    <PagoComprobanteCampos form={pagoForm} />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cargarMasTarde}
                    onChange={(e) => setCargarMasTarde(e.target.checked)}
                    className="accent-gold w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-black uppercase tracking-widest">Cargar más tarde</span>
                </label>
              </div>
            )}

            {/* Más opciones: notas + historial, cerrado por defecto — uso
                poco frecuente, no debería ocupar espacio arriba del fold. */}
            <div className="border border-hairline rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setMasOpcionesAbierto((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-prius-slate uppercase tracking-widest hover:text-black transition-all"
              >
                Más opciones
                <ChevronDown size={14} className={`transition-transform ${masOpcionesAbierto ? 'rotate-180' : ''}`} />
              </button>
              {masOpcionesAbierto && (
                <div className="px-4 pb-4 space-y-4 border-t border-hairline pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Notas</label>
                    <textarea
                      rows={3}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      className="w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-sm focus:border-gold/50 outline-none resize-none"
                    />
                  </div>
                  {editingReserva && (
                    <div>
                      <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Historial</p>
                      <Historial tipo="reserva" id={editingReserva.id} compact />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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

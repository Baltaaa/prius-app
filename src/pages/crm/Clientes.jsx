import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useClientes } from '../../hooks/useClientes'
import { useReservas } from '../../hooks/useReservas'
import { useRevealOnCheck } from '../../hooks/useRevealOnCheck'
import { usePagos } from '../../hooks/usePagos'
import { useDebounced } from '../../hooks/useDebounced'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { useOverlay } from '../../context/OverlayProvider'
import { formatPesosVisible, formatFecha, formatCUIT, formatDNI, unidadEmoji, formatComprobante, formatUnidad} from '../../lib/format'
import MontoStat from '../../components/ui/MontoStat'
import { cuitValido, parseDNI, parseUnidadQuery, normalizarNumeroComprobante } from '../../lib/parse'
import { scrollAndHighlight } from '../../lib/highlight'
import { registrarVisto } from '../../hooks/useRecientes'
import { validarClienteForm, requiereCuitClienteForm } from '../../lib/validators/cliente'
import {
  saldoNumerico, esPendienteConfirmacion, montoInfo, estadoBadgeStatus,
  esGrupo, saldoGrupo, estadoPagoGrupo, pagoSinVerificar,
} from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import LoadingButton from '../../components/ui/LoadingButton'
import { usePermiso } from '../../context/AuthProvider'
import Modal from '../../components/crm/Modal'
import BottomSheet from '../../components/ui-prius/BottomSheet'
import RegistrarPago from '../../components/crm/RegistrarPago'
import DetallePago from '../../components/crm/DetallePago'
import ClienteDetalleContent from '../../components/crm/ClienteDetalleContent'
import Historial from '../../components/crm/Historial'
import ScrollToTopButton from '../../components/crm/ScrollToTopButton'
import { useMountTransition } from '../../hooks/useMountTransition'
import MoneyInput from '../../components/inputs/MoneyInput'
import TextInput from '../../components/inputs/TextInput'
import PhoneInput from '../../components/inputs/PhoneInput'
import DniInput from '../../components/inputs/DniInput'
import CuitInput from '../../components/inputs/CuitInput'
import SelectChips from '../../components/inputs/SelectChips'
import SearchInput from '../../components/inputs/SearchInput'
import BrandSelect from '../../components/ui/BrandSelect'
import StatusBadge from '../../components/crm/StatusBadge'
import ConfirmarSuperadminModal from '../../components/crm/ConfirmarSuperadminModal'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'
import { Plus, Filter, Check, ChevronLeft, LayoutList } from 'lucide-react'

// Directorio MAESTRO: todo cliente histórico del balneario, tenga o no una
// reserva de período/día activa hoy — temporada actual, temporadas pasadas,
// períodos y días pasados, todo. La cola operativa de período/día vive en
// Reservas.jsx; acá no se filtra por tipo_alquiler. Ver CLAUDE.md "Reservas
// vs Clientes".
//
// Layout deliberadamente distinto de Reservas (que es tabla/feed): acá cada
// cliente es una fila-tarjeta expandible — toda la caja es clickeable (no un
// ícono chico) y expande inline su historial completo, sin modal ni ruta
// nueva. Acento cyan (en vez del dorado de Reservas) para que ambas
// pantallas no se confundan a simple vista, dentro de la misma paleta Glass
// Dark ya estandarizada.
const inputClass =
  'w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-base md:text-sm focus:border-cyan-400/50 outline-none font-bold'

// Unidades únicas asociadas a un cliente a partir de sus reservas VIGENTES
// (co-socio en varias unidades, o histórico de varias temporadas: puede haber
// más de una).
//
// Bug real (29/10/2026, caso Beatriz Ayala / carpa 11): acá NO se filtraba por
// estado, así que una reserva cancelada seguía aportando su unidad. El Plano
// mostraba la carpa libre (lee `unidades.estado`, que el trigger de Postgres
// sí actualiza al cancelar) pero Clientes la seguía mostrando vinculada —
// las dos pantallas leen la misma fuente de verdad y tienen que coincidir.
// Mismo criterio que `reservasPagables` más abajo. La reserva cancelada sigue
// visible en la lista de reservas del cliente y en el Historial con su chip
// CANCELADA: lo único que deja de hacer es contar como unidad asignada.
const unidadesDeReservas = (reservasCliente) => {
  const vistas = new Set()
  const out = []
  for (const r of reservasCliente) {
    if (r.estado === 'cancelada') continue
    const u = r.unidades
    if (!u) continue
    const key = u.id ?? `${u.tipo}-${u.numero}`
    if (vistas.has(key)) continue
    vistas.add(key)
    out.push(u)
  }
  return out
}

const MAX_UNIDADES_VISIBLES = 3

const FILTROS_ESTADO_CLIENTE = [
  { value: 'todos', label: 'Todos' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'parcial', label: 'Seña parcial' },
  { value: 'pendiente', label: 'Sin pago' },
  { value: 'pendiente_confirmacion', label: 'Sin confirmar' },
  { value: 'bonificada', label: 'Bonificada' },
]

// Reserva "de la temporada" para el badge único de la fila colapsada:
// prioriza la de tipo_alquiler='temporada' activa (lo más común en este
// directorio); si no hay, cae a la reserva activa más reciente de cualquier
// tipo, para que ningún cliente con solo período/día se quede sin badge.
const reservaActivaDeTemporada = (reservasCliente) => {
  const activas = reservasCliente.filter((r) => r.estado !== 'cancelada')
  if (activas.length === 0) return null
  const temporada = activas.find((r) => r.tipo_alquiler === 'temporada')
  if (temporada) return temporada
  return [...activas].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
}

// "Sin precio" (no "$ 0"): ninguna reserva activa del cliente tiene un
// valor_total real cargado todavía, y no es por bonificación ni por estar
// sin confirmar (esos casos ya tienen su propio texto/estado).
const precioSinDefinir = (reservasCliente) => {
  const activas = reservasCliente.filter((r) => r.estado !== 'cancelada')
  if (activas.length === 0) return false
  return activas.every((r) => {
    if (esPendienteConfirmacion(r)) return false
    const { pendiente, bonificada, valorTotal } = montoInfo(r)
    return !pendiente && !bonificada && !(Number(valorTotal) > 0)
  })
}

export default function Clientes() {
  const navigate = useNavigate()
  const { clientes, loading, createCliente, updateCliente, deleteCliente } = useClientes()
  const {
    reservas, unidades, temporadaActiva, loading: resLoading, createReserva, updateReserva, cancelarReserva, crearGrupoReservas,
  } = useReservas()
  const { pagos: todosPagos } = usePagos() // sin reservaId: historial completo, filtrado acá por cliente
  const readyClientes = useInitialLoad(loading || resLoading)

  const GRUPO_UNIDAD_CLIENTES = { carpa: 'Carpas', sombrilla: 'Sombrillas', cabina: 'Cabinas', locker: 'Lockers' }
  const opcionesUnidadTemporada = useMemo(
    () =>
      [...unidades]
        .sort((a, b) => (GRUPO_UNIDAD_CLIENTES[a.tipo] || a.tipo).localeCompare(GRUPO_UNIDAD_CLIENTES[b.tipo] || b.tipo) || a.numero - b.numero)
        .map((u) => ({ value: u.id, group: GRUPO_UNIDAD_CLIENTES[u.tipo] || u.tipo, label: `${unidadEmoji(u.tipo)} ${formatUnidad(u.tipo, u.numero)}` })),
    [unidades],
  )
  const puedeBonificar = usePermiso('bonificar')
  // Corregir un monto mal cargado (ej. error de tipeo del administrador) —
  // mismo modal/flujo de "Definir precio", solo que pre-llenado con el valor
  // actual. Detrás de `ajustes_precio` (solo superadmin, oct 2026).
  const puedeAjustarPrecio = usePermiso('ajustes_precio')
  const [searchParams, setSearchParams] = useSearchParams()
  const { alert, confirm, toast } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [showFiltros, setShowFiltros] = useState(false)
  const filtrosOverlay = useOverlay({ id: 'clientes-filtros', isOpen: showFiltros, onRequestClose: () => setShowFiltros(false) })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [pagoCliente, setPagoCliente] = useState(null)
  const [pagoCelda, setPagoCelda] = useState(null) // { reserva, pago } | null — click en PagosGrid
  const [expandedId, setExpandedId] = useState(null) // cliente seleccionado — un solo detalle a la vez
  // Breakpoints de maestro-detalle (mismo patrón que Reservas.jsx): desktop
  // ≥1024px panel fijo, tablet 768-1023px bottom sheet, mobile <768px
  // pantalla completa.
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

  // Acción primaria "Confirmar temporada" de una reserva pendiente_confirmacion:
  // define el precio (valor_total) recién ahora — el trigger
  // fn_pago_actualiza_saldo saca sola la reserva de pendiente_confirmacion en
  // cuanto valor_total > 0.
  const [confirmarReserva, setConfirmarReserva] = useState(null) // { reserva, cliente } | null
  const [confirmarValorTotal, setConfirmarValorTotal] = useState(0)
  const [savingConfirmacion, setSavingConfirmacion] = useState(false)

  const handleSubmitConfirmarReserva = async (e) => {
    e.preventDefault()
    if (!confirmarReserva) return
    setSavingConfirmacion(true)
    try {
      await updateReserva(confirmarReserva.reserva.id, { valor_total: Number(confirmarValorTotal || 0) })
      setConfirmarReserva(null)
    } catch (err) {
      await alert('No se pudo confirmar la reserva.')
    } finally {
      setSavingConfirmacion(false)
    }
  }

  // Form states — cliente
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState(null)
  const [telefonoTocado, setTelefonoTocado] = useState(false)
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [condicionIva, setCondicionIva] = useState('consumidor_final')
  const [razonSocial, setRazonSocial] = useState('')
  const [mail, setMail] = useState('')
  const [notas, setNotas] = useState('')

  // Alta de reserva de temporada (Fase 1, sep 2026): vive del lado de
  // Clientes, no de Reservas, porque un "cliente de temporada" es un
  // registro en `reservas` con tipo_alquiler='temporada' vinculado a un
  // cliente_id — Reservas.jsx ahora es solo la cola de período/día y ese
  // tipo se sacó a propósito de su selector. Único punto de entrada: checkbox
  // opcional al crear un cliente nuevo (el botón "Agregar Temporada" para un
  // cliente ya existente se sacó, oct 2026).
  const [agregarTemporadaNueva, setAgregarTemporadaNueva] = useState(false)
  const revealTemporadaNuevaRef = useRevealOnCheck(agregarTemporadaNueva)
  const [tUnidadId, setTUnidadId] = useState('')
  const [tValorTotal, setTValorTotal] = useState(0)
  const [tNotas, setTNotas] = useState('')
  // Unidad bonificada (sep 2026): fuerza el precio a 0 y lo deshabilita — el
  // trigger fn_reserva_recalcula_saldo hace cumplir esto igual en la base.
  const [tBonificada, setTBonificada] = useState(false)

  const resetTemporadaForm = () => {
    setTUnidadId('')
    setTValorTotal(0)
    setTNotas('')
    setTBonificada(false)
  }

  const handleOpenCreate = () => {
    setEditingCliente(null)
    setNombre('')
    setTelefono(null)
    setTelefonoTocado(false)
    setDni('')
    setCuit('')
    setCondicionIva('consumidor_final')
    setRazonSocial('')
    setMail('')
    setNotas('')
    setAgregarTemporadaNueva(false)
    resetTemporadaForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (cliente) => {
    setEditingCliente(cliente)
    setNombre(cliente.nombre)
    setTelefono(cliente.telefono || null)
    setTelefonoTocado(false)
    setDni(cliente.dni || '')
    setCuit(cliente.cuit || '')
    setCondicionIva(cliente.condicion_iva || 'consumidor_final')
    setRazonSocial(cliente.razon_social || '')
    setMail(cliente.mail || '')
    setNotas(cliente.notas || '')
    setIsModalOpen(true)
  }

  const requiereCuit = requiereCuitClienteForm(condicionIva)
  const clienteFormErrors = validarClienteForm({ nombre, telefono, condicionIva, cuit, dni, mail }, razonSocial)
  const cuitFormularioValido = !clienteFormErrors.cuit
  const razonSocialValida = !clienteFormErrors.razonSocial

  const [savingCliente, setSavingCliente] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (Object.keys(clienteFormErrors).length > 0) return
    const payload = {
      nombre: nombre.toUpperCase(), telefono, dni: dni || null, cuit: cuit || null,
      condicion_iva: condicionIva, razon_social: razonSocial || null, mail, notas,
    }
    setSavingCliente(true)
    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, payload)
      } else {
        const nuevoCliente = await createCliente(payload)
        if (agregarTemporadaNueva && tUnidadId) {
          await createReserva({
            cliente_id: nuevoCliente.id,
            unidad_id: tUnidadId,
            // temporada / temporada_id: los asigna solo el trigger
            // fn_reserva_asigna_temporada (Frente 2), no se mandan a mano.
            tipo_alquiler: 'temporada',
            estado: 'activa',
            origen: 'manual',
            valor_total: tBonificada ? 0 : Number(tValorTotal || 0),
            bonificada: tBonificada,
            notas: tNotas,
          })
        }
      }
      setIsModalOpen(false)
      toast(editingCliente ? 'Cliente actualizado con éxito' : 'Cliente creado con éxito', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'Error guardando cliente.', { tone: 'error' })
    } finally {
      setSavingCliente(false)
    }
  }

  const [clienteAEliminar, setClienteAEliminar] = useState(null)

  // Agrupar reservas sueltas bajo un precio unificado (oct 2026, caso Ana
  // Lescano) — ver crearGrupoReservas en DataProvider y lib/reservas.js.
  const [agruparCliente, setAgruparCliente] = useState(null) // cliente, o null
  const [agruparSeleccion, setAgruparSeleccion] = useState(new Set())
  const [agruparPrecioTotal, setAgruparPrecioTotal] = useState(0)
  const [agruparTemporada, setAgruparTemporada] = useState('')
  const [savingGrupo, setSavingGrupo] = useState(false)

  // Liberar unidad (oct 2026): desvincula al cliente de esta reserva/unidad
  // para poder traspasarla a otro cliente — mismo mecanismo que "Cancelar
  // reserva" en Reservas.jsx (soft delete, estado='cancelada'), que ahí solo
  // cubre período/día; acá cubre también temporada, que es donde vive el
  // caso real de traspaso. Si está bloqueada, primero hay que desbloquear
  // (mismo flujo que Reservas.jsx `asegurarDesbloqueada`).
  const handleLiberarUnidad = async (r) => {
    if (r.bloqueada) {
      const okDesbloquear = await confirm(
        'Esta reserva está bloqueada. Hay que desbloquearla primero para poder continuar. ¿Desbloquear?',
        { title: 'Desbloquear reserva' },
      )
      if (!okDesbloquear) return
      try {
        await updateReserva(r.id, { bloqueada: false })
      } catch (err) {
        await alert('No se pudo desbloquear la reserva.')
        return
      }
    }
    const unidadLabel = r.unidades ? formatUnidad(r.unidades.tipo, r.unidades.numero) : 'la unidad'
    const ok = await confirm(
      `Se va a liberar ${unidadLabel} y desvincular a este cliente de la reserva. La reserva pasa a "cancelada" (no se borra, queda en el historial) y la unidad queda disponible para asignar a otro cliente. ¿Confirmar?`,
      { title: 'Liberar unidad' },
    )
    if (!ok) return
    try {
      await cancelarReserva(r.id)
    } catch (err) {
      await alert('No se pudo liberar la unidad.')
    }
  }

  const handleAbrirAgrupar = (cliente) => {
    setAgruparCliente(cliente)
    setAgruparSeleccion(new Set())
    setAgruparPrecioTotal(0)
    setAgruparTemporada(temporadaActiva?.nombre || '')
  }

  const handleToggleSeleccionGrupo = (reservaId) => {
    setAgruparSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(reservaId)) next.delete(reservaId)
      else next.add(reservaId)
      return next
    })
  }

  const handleCrearGrupo = async () => {
    if (!agruparCliente || agruparSeleccion.size < 2 || !agruparPrecioTotal) return
    setSavingGrupo(true)
    try {
      await crearGrupoReservas({
        clienteId: agruparCliente.id,
        temporada: agruparTemporada,
        precioTotal: Number(agruparPrecioTotal),
        reservaIds: Array.from(agruparSeleccion),
      })
      setAgruparCliente(null)
    } catch (err) {
      await alert(err.message || 'No se pudo agrupar las reservas.')
    } finally {
      setSavingGrupo(false)
    }
  }

  const handleConfirmDeleteCliente = async (password) => {
    if (!clienteAEliminar) return
    await deleteCliente(clienteAEliminar.id, password)
    setClienteAEliminar(null)
  }

  // Click manual en una fila (no deep-link): al expandir, centra la fila en
  // el viewport con scroll suave — si el click la colapsa, no hay que
  // scrollear a ningún lado. Misma carrera que el deep-link de abajo (el
  // contenido expandido sigue creciendo unos ms por el fetch de pagos), pero
  // acá sí vale la pena el 'smooth' porque la fila ya está a la vista o cerca
  // — no es el salto a mitad de un directorio sin virtualizar.
  const handleToggleExpand = (clienteId, wasExpanded) => {
    setExpandedId(wasExpanded ? null : clienteId)
    if (wasExpanded) return
    registrarVisto('cliente', clienteId) // [feat-4]
    setTimeout(() => {
      document.querySelector(`[data-cliente-id="${clienteId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  // Deep-link vía linkToCliente() (Tarea 1, oct 2026): desde la búsqueda
  // global del TopBar, Notificaciones, Historial, etc. — abre directo la
  // fila expandida de ese cliente y la centra en el viewport (el directorio
  // está ordenado alfabéticamente con cientos de clientes, así que la fila
  // casi nunca está a la vista de entrada). Con `?pago=<uuid>` resalta esa
  // cuota puntual en vez de la fila completa — así "Ver pago" desde
  // Notificaciones cae exactamente en la celda referida, no solo en el
  // cliente.
  useDeepLinkTarget({
    params: ['id', 'pago', 'reserva', 'accion'],
    ready: !loading,
    resolve: ({ id, pago, reserva, accion }) => {
      const cliente = clientes.find((c) => c.id === id)
      if (!cliente) return null
      setExpandedId(cliente.id)
      // [feat-2] accion=pagar (desde la notificación de saldo pendiente):
      // abre directo RegistrarPago para esa reserva, no solo resalta.
      if (accion === 'pagar') {
        const reservaObj = reserva
          ? (reservasPorCliente[cliente.id] || []).find((r) => r.id === reserva)
          : (reservasPorCliente[cliente.id] || []).find((r) => r.estado !== 'cancelada' && !r.bonificada && Number(r.saldo) > 0)
        if (reservaObj) {
          setPagoCelda({ reserva: { ...reservaObj, clientes: cliente }, pago: null })
          return true
        }
      }
      // accion=cargar_monto (oct 2026, notificación pago_sin_monto): abre
      // DetallePago directo con el campo de monto ya en edición.
      if (accion === 'cargar_monto' && pago) {
        const pagoObj = todosPagos.find((p) => p.id === pago)
        if (pagoObj) {
          const reservaObj = pagoObj.reserva_id
            ? (reservasPorCliente[cliente.id] || []).find((r) => r.id === pagoObj.reserva_id)
            : null
          setPagoCelda({ reserva: reservaObj ? { ...reservaObj, clientes: cliente } : null, pago: pagoObj, autoAbrirMonto: true })
          return true
        }
      }
      // accion=cargar_recibos (oct 2026, notificación "Recibos sin monto
      // asignado (N)"): recorre en secuencia TODOS los recibos sin monto de
      // esa reserva, en orden cronológico — "Recibo 1 de N" → guardar →
      // "Recibo 2 de N" — con el mismo form de RegistrarPago en edición.
      if (accion === 'cargar_recibos' && reserva) {
        const reservaObj = (reservasPorCliente[cliente.id] || []).find((r) => r.id === reserva)
        const pagosSinMonto = todosPagos
          .filter((p) => p.reserva_id === reserva && p.estado !== 'anulado' && pagoSinVerificar(p))
          .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
        if (reservaObj && pagosSinMonto.length > 0) {
          setPagoCelda({
            reserva: { ...reservaObj, clientes: cliente },
            pago: pagosSinMonto[0],
            editando: true,
            secuencia: { pagos: pagosSinMonto, idx: 0 },
          })
          return true
        }
      }
      // accion=asignar_precio (oct 2026, notificación "Asignar monto total
      // de unidad"): abre directo "Definir precio" para esa reserva — mismo
      // modal que ya usa PagosGrid ("Definir precio") y el botón de la fila
      // de RESERVAS, sin crear uno nuevo.
      if (accion === 'asignar_precio' && reserva) {
        const reservaObj = (reservasPorCliente[cliente.id] || []).find((r) => r.id === reserva)
        if (reservaObj) {
          setConfirmarValorTotal(0)
          setConfirmarReserva({ reserva: reservaObj, cliente })
          return true
        }
      }
      if (pago) return `pago-${pago}`
      if (reserva) return `reserva-${reserva}`
      return cliente.id
    },
  })

  // Deep-link desde "Asignar cliente de temporada" en el modal de unidad del
  // Plano: /app/clientes?unidad=<uuid>&tipo=temporada — abre el alta de
  // cliente nuevo con la unidad ya precargada en el form de temporada. Solo
  // arma un cliente NUEVO.
  useEffect(() => {
    const unidad = searchParams.get('unidad')
    if (!unidad || searchParams.get('id') || loading) return
    handleOpenCreate()
    setAgregarTemporadaNueva(true)
    setTUnidadId(unidad)
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading])

  const debouncedSearch = useDebounced(searchTerm, 250)

  // Comprobante que matcheó la búsqueda para cada cliente (Tarea 3, oct
  // 2026) — se muestra como una línea extra bajo el nombre y permite
  // saltar directo a esa cuota. Normalizado (sin guiones/espacios/ceros a
  // la izquierda) para que "1234", "0001-00001234" y "00001234" encuentren
  // el mismo comprobante — match parcial, no exacto.
  const comprobanteMatchPorCliente = useMemo(() => {
    const termNorm = normalizarNumeroComprobante(debouncedSearch)
    if (termNorm.length < 2) return {}
    const map = {}
    for (const p of todosPagos) {
      if (map[p.cliente_id]) continue
      const c = (p.comprobantes || []).find((c) => normalizarNumeroComprobante(c.numero).includes(termNorm))
      if (c) map[p.cliente_id] = { pago: p, comprobante: c }
    }
    return map
  }, [todosPagos, debouncedSearch])

  const filteredClientes = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (term.length < 2) return clientes
    const dniTerm = parseDNI(debouncedSearch)
    const unidadQuery = parseUnidadQuery(term)
    return clientes.filter((c) => {
      if (c.nombre.toLowerCase().includes(term)) return true
      if (c.apellido && c.apellido.toLowerCase().includes(term)) return true
      if (c.cuit && c.cuit.includes(debouncedSearch)) return true
      if (dniTerm.length >= 7 && c.dni && c.dni.includes(dniTerm)) return true
      if (comprobanteMatchPorCliente[c.id]) return true
      if (unidadQuery) {
        return reservas.some((r) => r.cliente_id === c.id && r.unidades?.numero === unidadQuery.numero
          && (!unidadQuery.tipo || r.unidades?.tipo === unidadQuery.tipo))
      }
      return false
    })
  }, [clientes, debouncedSearch, reservas, comprobanteMatchPorCliente])

  // TODAS las reservas de cada cliente (histórico completo: activas y
  // canceladas, cualquier tipo_alquiler) — a diferencia de Reservas.jsx, acá
  // no se filtra nada: este es el directorio maestro.
  const reservasPorCliente = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      if (!r.cliente_id) continue
      ;(map[r.cliente_id] ||= []).push(r)
    }
    return map
  }, [reservas])

  // Pagos de cada reserva puntual — no vienen embebidos en `reservas`, hay que
  // indexar `todosPagos` (historial completo) por reserva_id.
  const pagosPorReserva = useMemo(() => {
    const map = {}
    for (const p of todosPagos) {
      ;(map[p.reserva_id] ||= []).push(p)
    }
    return map
  }, [todosPagos])

  // Reservas donde el cliente aparece como CO-SOCIO (reserva_clientes) sin ser
  // el titular (r.cliente_id). Ítem 3 (25/10/2026): antes solo se usaba para
  // el badge de unidad de la cabecera, y un cliente que SOLO era cosocio
  // (nunca titular de nada) quedaba sin badge de estado ni saldo en su
  // propia ficha/card — ahora se mezcla con reservasPorCliente en
  // `derivarCliente` para que un cosocio vea exactamente lo mismo que un
  // titular: misma etiqueta de estado de la reserva compartida, mismo
  // saldo pendiente, misma lista de reservas/pagos. Nunca hay duplicados:
  // esta tabla excluye explícitamente al titular de cada reserva (abajo),
  // así que una reserva nunca cae en los dos mapas para la misma persona.
  const reservasComoCoSocioPorCliente = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      for (const rc of r.reserva_clientes || []) {
        if (!rc.cliente_id || rc.cliente_id === r.cliente_id) continue
        ;(map[rc.cliente_id] ||= []).push(r)
      }
    }
    return map
  }, [reservas])

  // Filtro por estado (badge): mismo criterio que el badge del header de cada
  // fila — un grupo con precio unificado manda por sobre cualquier período
  // suelto, igual que en el render.
  const clientesVisibles = useMemo(() => {
    if (filtroEstado === 'todos') return filteredClientes
    return filteredClientes.filter((cliente) => {
      const reservasCliente = [
        ...(reservasPorCliente[cliente.id] || []),
        ...(reservasComoCoSocioPorCliente[cliente.id] || []),
      ]
      const grupo = reservasCliente.find((r) => esGrupo(r) && r.estado !== 'cancelada')
      if (grupo) {
        return estadoPagoGrupo(saldoGrupo(grupo, reservas, pagosPorReserva), grupo.reserva_grupos) === filtroEstado
      }
      const badge = reservaActivaDeTemporada(reservasCliente)
      return badge ? estadoBadgeStatus(badge) === filtroEstado : false
    })
  }, [filteredClientes, filtroEstado, reservasPorCliente, reservasComoCoSocioPorCliente, reservas, pagosPorReserva])

  // Saldo total por cliente: SIEMPRE derivado de estado_pago + pagos reales
  // (saldoNumerico), nunca del campo suelto `reserva.saldo` — para temporada
  // migrada del excel histórico ese campo quedó siempre vacío/"$-", no es un
  // valor calculado real (bug detectado con AGUSTIN, Sombrilla #27: badge
  // "PARCIAL" + "Unidad saldada" al mismo tiempo). Si algún cliente tiene una
  // reserva con saldo sin verificar (precio ambiguo o pago sin verificar), el
  // total completo se marca `sinVerificar` — sumar un número real más un
  // "no sabemos cuánto" daría un total falso.
  // Ítem 3 (25/10/2026): el saldo se acredita al titular Y a cada cosocio de
  // la reserva (reserva_clientes) — antes solo al titular, así que un
  // cliente que es SOLO cosocio (nunca titular) quedaba siempre en $0.
  // `gruposContados` pasa a ser por (cliente, grupo) en vez de solo grupo,
  // para que cada persona cuente el saldo del grupo una sola vez cada una
  // (titular y cosocios ven el mismo monto, pero el Set global de antes
  // habría salteado a un cosocio si el titular ya había "gastado" esa
  // marca en una vuelta anterior del loop).
  const saldoPorCliente = useMemo(() => {
    const map = {}
    const gruposContados = new Set()
    const acreditar = (clienteId, r) => {
      if (!clienteId) return
      const entry = (map[clienteId] ||= { total: 0, sinVerificar: false })
      if (esGrupo(r)) {
        const key = `${clienteId}:${r.grupo_id}`
        if (gruposContados.has(key)) return
        gruposContados.add(key)
        const saldo = saldoGrupo(r, reservas, pagosPorReserva)
        if (saldo === null) entry.sinVerificar = true
        else entry.total += saldo
        return
      }
      const saldo = saldoNumerico(r, pagosPorReserva[r.id] || [])
      if (saldo === null) entry.sinVerificar = true
      else entry.total += saldo
    }
    for (const r of reservas) {
      if (r.estado === 'cancelada') continue
      acreditar(r.cliente_id, r)
      for (const rc of r.reserva_clientes || []) {
        if (!rc.cliente_id || rc.cliente_id === r.cliente_id) continue
        acreditar(rc.cliente_id, r)
      }
    }
    return map
  }, [reservas, pagosPorReserva])

  // Toda la información derivada de un cliente puntual (badge, saldo, grupos,
  // reservas sueltas, etc.) — un solo cálculo reusado tanto por la fila
  // compacta de la lista como por el panel/pantalla de detalle
  // (ClienteDetalleContent), así nunca se desincronizan entre sí.
  const derivarCliente = (cliente) => {
    // Ítem 3 (25/10/2026): combina las reservas donde es titular + donde es
    // cosocio — un cosocio puro (nunca titular de nada) ahora calcula badge/
    // saldo/pagables igual que un titular, en vez de quedar en $0 sin badge.
    const reservasCliente = [
      ...(reservasPorCliente[cliente.id] || []),
      ...(reservasComoCoSocioPorCliente[cliente.id] || []),
    ]
    const saldoInfo = saldoPorCliente[cliente.id] || { total: 0, sinVerificar: false }
    const unidadesCliente = unidadesDeReservas(reservasCliente)
    const reservaGrupoCliente = reservasCliente.find((r) => esGrupo(r) && r.estado !== 'cancelada')
    const reservaBadge = reservaGrupoCliente || reservaActivaDeTemporada(reservasCliente)
    const sinPrecio = !reservaGrupoCliente && precioSinDefinir(reservasCliente)
    const reservasPagables = reservasCliente.filter((r) => r.estado !== 'cancelada' && !r.bonificada)
    const badgeStatus = reservaGrupoCliente
      ? estadoPagoGrupo(saldoGrupo(reservaGrupoCliente, reservas, pagosPorReserva), reservaGrupoCliente.reserva_grupos)
      : (reservaBadge ? estadoBadgeStatus(reservaBadge) : null)
    const saldoHeaderSaldado = reservaGrupoCliente
      ? badgeStatus === 'pagado'
      : reservaBadge && (reservaBadge.estado_pago === 'pagado' || reservaBadge.bonificada)
    const reservasSueltas = reservasCliente.filter((r) => !r.grupo_id)
    const comprobantesPendientesCliente = todosPagos
      .filter((p) => p.cliente_id === cliente.id && p.estado !== 'anulado' && pagoSinVerificar(p)).length
    const gruposCliente = {}
    for (const r of reservasCliente) {
      if (r.grupo_id) (gruposCliente[r.grupo_id] ||= []).push(r)
    }
    return {
      reservasCliente, saldoInfo, unidadesCliente, reservaBadge, sinPrecio, reservasPagables,
      badgeStatus, saldoHeaderSaldado, reservasSueltas, comprobantesPendientesCliente, gruposCliente,
      comprobanteMatch: comprobanteMatchPorCliente[cliente.id] || null,
    }
  }

  const clienteSeleccionado = expandedId ? clientes.find((c) => c.id === expandedId) : null
  const derivadoSeleccionado = clienteSeleccionado ? derivarCliente(clienteSeleccionado) : null
  const handleCloseDetalle = () => setExpandedId(null)
  // Mobile (<768px): pantalla completa, con el mismo "congelar último valor"
  // que Reservas.jsx/UnidadPreviewModal para que la animación de cierre (B1)
  // tenga contenido que mostrar mientras se desmonta.
  const mobileDetalleShouldRender = useMountTransition(isMobile && !!clienteSeleccionado)
  const lastDetalleClienteRef = useRef(clienteSeleccionado)
  if (clienteSeleccionado) lastDetalleClienteRef.current = clienteSeleccionado
  const mobileDetalleCliente = clienteSeleccionado ?? lastDetalleClienteRef.current
  const mobileDetalleDerivado = mobileDetalleCliente ? derivarCliente(mobileDetalleCliente) : null

  if (!readyClientes) {
    return (
      <div className="space-y-6 font-ui">
        <Skeleton className="h-12" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    )
  }

  return (
    // Alto fijo al viewport en desktop (mini-prompt 26/10/2026), mismo
    // patrón que Reservas.jsx: `lg:h-full` hereda la altura que le da
    // AppLayout.jsx (`#app-main-scroll` dejó de scrollear en esta sección),
    // `lg:gap-4` reemplaza a `space-y-10` solo en desktop.
    <div className="space-y-10 lg:space-y-0 lg:h-full lg:flex lg:flex-col lg:gap-4 animate-premium-fade">
      {/* Toolbar: buscador a ancho completo arriba, filtro + alta compacta
          abajo (oct 2026) — antes "Nuevo Cliente" era una barra amarilla
          gigante en mobile; ahora es un botón chico (h-10) a la derecha,
          misma fila que el filtro ESTADO, en todos los breakpoints. */}
      {/* Topbar de sección en una sola línea en desktop (ítem 6, oct 2026):
          buscador propio con el MISMO ancho que el buscador global del
          header (w-48 lg:w-64 xl:w-80), filtro Estado al lado, Nuevo
          Cliente alineado a la derecha — los tres con la misma altura
          (h-10). En mobile/tablet se mantiene el buscador a ancho completo
          arriba y el filtro+alta abajo (mejor para touch). */}
      <div className={`${isDesktopLG ? 'flex items-center gap-3' : 'space-y-3'} lg:shrink-0`}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nombre, DNI, CUIT o unidad (ej. carpa 19)..."
          className={isDesktopLG ? 'w-48 lg:w-64 xl:w-80 min-w-0 shrink' : 'w-full'}
          inputClassName={isDesktopLG ? 'h-10 min-h-0 py-0 focus:border-gold/50' : 'focus:border-gold/50 py-3'}
        />
        <div className={isDesktopLG ? 'flex items-center gap-3 flex-1 min-w-0' : 'flex items-center gap-3'}>
          <div ref={filtrosOverlay.bind} className="relative">
            <button
              onClick={() => setShowFiltros((v) => !v)}
              className={`h-10 px-4 bg-white border border-hairline rounded-xl flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest ${filtroEstado !== 'todos' ? 'text-gold' : 'text-prius-slate hover:text-black'}`}
            >
              <Filter size={16} /> {filtroEstado !== 'todos' ? FILTROS_ESTADO_CLIENTE.find((f) => f.value === filtroEstado)?.label : 'Estado'}
            </button>
            {showFiltros && (
                <div className="absolute left-0 mt-2 w-48 bg-white border border-hairline rounded-xl overflow-hidden z-50 p-3 shadow-sm">
                  {FILTROS_ESTADO_CLIENTE.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => { setFiltroEstado(f.value); setShowFiltros(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-prius-slate hover:bg-prius-surface flex items-center justify-between rounded-lg"
                    >
                      {f.label}
                      {filtroEstado === f.value && <Check size={14} className="text-gold" />}
                    </button>
                  ))}
                </div>
            )}
          </div>
          <div className="flex-1" />
          <button
            onClick={handleOpenCreate}
            className="h-10 px-4 bg-gold hover:bg-gold-hover text-black rounded-xl transition-all flex items-center gap-2 font-semibold text-label-lg shrink-0"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Nuevo Cliente</span><span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Directorio maestro-detalle (oct 2026, mock 04-clientes): lista
          compacta a la izquierda (ancho fijo ≥1024px, columna completa
          abajo), detalle en panel fijo / bottom sheet / pantalla completa
          según breakpoint — mismo patrón que Reservas.jsx. */}
      {/* `items-start` sacado (mini-prompt 26/10/2026): con eso cada columna
          medía su propio contenido y la ficha terminaba más alta/baja que
          la lista. Sin esa clase, el stretch por default del flex hace que
          las dos cajas midan exactamente lo mismo — el alto real lo pone
          `lg:flex-1 lg:min-h-0` (le pasa al row el alto sobrante del
          flex-col de más arriba), no un cálculo a mano. */}
      <div className={`${isDesktopLG ? 'flex gap-space-lg' : ''} lg:flex-1 lg:min-h-0`}>
        {/* w-[480px] fijo (hasta oct 2026) dejaba casi sin aire al panel
            fijo de la derecha justo en el arranque del breakpoint lg
            (1024-1150px aprox, con Sidebar de 256px descontado): el texto
            del panel terminaba partiéndose letra por letra. flex-1 con
            min/max fluido reparte el espacio sobrante con el aside en vez
            de forzar un ancho fijo que no entra. `lg:h-full
            lg:overflow-y-auto` (mini-prompt 26/10/2026): la lista scrollea
            adentro de su propia caja en vez de empujar la altura de la
            página. */}
        <div className={isDesktopLG ? 'flex-1 min-w-[280px] max-w-[480px] shrink lg:h-full lg:overflow-y-auto' : 'w-full'}>
          {clientesVisibles.length === 0 ? (
            <div className="p-12 text-center text-sm tracking-wider text-prius-muted bg-white border border-hairline rounded-xl">
              No se encontraron clientes.
            </div>
          ) : (
            <div className="space-y-2">
              {clientesVisibles.map((cliente, i) => {
                const d = derivarCliente(cliente)
                const isSelected = expandedId === cliente.id
                // Agrupamiento alfabético (mock 04-clientes-mobile): solo en
                // la lista de ancho completo (tablet/mobile) — el maestro-
                // detalle de desktop no lo muestra, mismo criterio del mock.
                const letra = (cliente.nombre || '?').trim()[0]?.toUpperCase() || '?'
                const letraAnterior = i > 0 ? (clientesVisibles[i - 1].nombre || '?').trim()[0]?.toUpperCase() || '?' : null
                const mostrarGrupo = !isDesktopLG && letra !== letraAnterior
                const totalGrupo = !isDesktopLG && mostrarGrupo
                  ? clientesVisibles.filter((c) => ((c.nombre || '?').trim()[0]?.toUpperCase() || '?') === letra).length
                  : 0
                return (
                  <React.Fragment key={cliente.id}>
                  {mostrarGrupo && (
                    <p className="text-label-md font-bold text-prius-slate uppercase tracking-wider pt-2 first:pt-0">
                      {letra} · {totalGrupo} cliente{totalGrupo > 1 ? 's' : ''}
                    </p>
                  )}
                  <div
                    data-cliente-id={cliente.id}
                    data-deeplink-id={cliente.id}
                    onClick={() => setExpandedId(isSelected ? null : cliente.id)}
                    // flex, no grid (Bloque 3, oct 2026): con grid, columnas
                    // minmax(0,Npx) que conviven con un track 1fr crecen
                    // hasta su tope ANTES de repartir el sobrante al 1fr
                    // (paso "maximize non-flexible tracks" del algoritmo de
                    // grid) — el nombre quedaba con ~80px sin importar el
                    // ancho real de saldo/unidad. Con flex, shrink-0 +
                    // ancho fijo en las columnas de la derecha se comporta
                    // como se espera: el nombre (flex-1 min-w-0) se lleva
                    // todo el sobrante real.
                    className={`bg-white rounded-xl border px-4 py-4 min-h-[76px] flex items-center gap-x-2 cursor-pointer transition-all ${
                      isSelected ? 'border-gold bg-prius-surface' : 'border-hairline hover:bg-prius-surface'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {cliente.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                    </div>

                    {/* Nombre + estado (pulido UX, oct 2026, item 3): antes
                        el teléfono ocupaba el segundo renglón y el badge de
                        estado competía con el nombre en el primero (lo
                        truncaba a "A.."). El teléfono ya se ve dentro de la
                        ficha — acá va: renglón 1 nombre completo, renglón 2
                        el badge de estado (mismo estadoBadgeStatus de
                        siempre, sin tocar el mapeo). */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-black truncate">{cliente.nombre}</p>
                      {/* 29/10/2026: el wrapper del badge solo se monta si HAY
                          badge. Antes iba siempre con `min-h-[18px]`, así que
                          un cliente sin estado (ej. BEATRIZ AYALA) igual
                          ocupaba dos renglones y el `items-center` de la fila
                          centraba el avatar contra el nombre + ese hueco
                          vacío, dejándolo visualmente desalineado del nombre. */}
                      {d.badgeStatus && (
                        <div className="mt-1 min-h-[18px]">
                          <StatusBadge status={d.badgeStatus} />
                        </div>
                      )}
                      {d.comprobanteMatch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId(cliente.id)
                            scrollAndHighlight(`pago-${d.comprobanteMatch.pago.id}`)
                          }}
                          className="text-[10px] text-gold font-bold mt-1 hover:underline truncate block max-w-full text-left"
                        >
                          Comprobante {formatComprobante(d.comprobanteMatch.comprobante.tipo, d.comprobanteMatch.comprobante.numero)}
                          {formatPesosVisible(d.comprobanteMatch.pago.monto) ? ` · ${formatPesosVisible(d.comprobanteMatch.pago.monto)}` : ''}
                        </button>
                      )}
                    </div>

                    {/* Columna derecha (pulido UX, oct 2026, item 3): saldo
                        pendiente arriba (si hay) y unidad debajo, en una
                        sola columna alineada a la derecha — antes eran dos
                        bloques lado a lado. Sin saldo, items-center en la
                        fila ya centra verticalmente este bloque (más chico)
                        contra el bloque de nombre+badge de la izquierda. */}
                    <div className="flex flex-col items-end gap-1 shrink-0 max-w-[128px]">
                      {d.saldoInfo.sinVerificar ? (
                        d.saldoHeaderSaldado ? null : (
                          <div className="text-right">
                            <p className="text-prius-error text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">Saldo sin verificar</p>
                            {d.comprobantesPendientesCliente > 0 && (
                              <p className="text-prius-muted font-normal normal-case tracking-normal text-[10px] truncate">
                                {d.comprobantesPendientesCliente} comprobante{d.comprobantesPendientesCliente > 1 ? 's' : ''} sin monto
                              </p>
                            )}
                          </div>
                        )
                      ) : d.sinPrecio ? (
                        <span className="text-prius-slate text-[10px] uppercase tracking-widest font-bold whitespace-nowrap">Sin precio</span>
                      ) : (
                        formatPesosVisible(d.saldoInfo.total) && (
                          <MontoStat value={d.saldoInfo.total} size="xs" className="text-prius-error" />
                        )
                      )}

                      <div
                        className="flex items-baseline justify-end gap-1 tabular-nums"
                        title={d.unidadesCliente.map((u) => `${unidadEmoji(u.tipo)} ${formatUnidad(u.tipo, u.numero)}`).join(', ')}
                      >
                        {d.unidadesCliente.length === 0 ? (
                          <span className="text-[11px] text-prius-muted font-bold tracking-widest">Sin unidad</span>
                        ) : (
                          <>
                            {d.unidadesCliente.slice(0, MAX_UNIDADES_VISIBLES).map((u, i) => (
                              <span key={u.id ?? i} className="flex items-baseline gap-1 leading-none">
                                <span className="text-base leading-none">{unidadEmoji(u.tipo)}</span>
                                <span className="text-base font-extrabold text-black leading-none">{u.numero}</span>
                              </span>
                            ))}
                            {d.unidadesCliente.length > MAX_UNIDADES_VISIBLES && (
                              <span className="text-[10px] text-prius-muted font-bold tracking-widest">
                                +{d.unidadesCliente.length - MAX_UNIDADES_VISIBLES}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel fijo — solo ≥1024px. Altura SIEMPRE igual a la de la lista
            (mini-prompt 26/10/2026): ya no es sticky ni calcula su propio
            alto a mano — vive en el mismo row `lg:flex-1 lg:min-h-0` que la
            lista, sin `items-start`, así que el stretch por default le da
            exactamente ese alto. key={clienteId} fuerza un remount que
            dispara el crossfade (content-crossfade, 180ms, fade + 6px — ver
            index.css) cada vez que cambia el cliente. */}
        {isDesktopLG && (
          <aside className="hidden lg:flex lg:h-full flex-1 min-w-[320px] bg-white border border-hairline rounded-2xl p-space-lg flex-col overflow-hidden">
            {clienteSeleccionado ? (
              <div key={clienteSeleccionado.id} className="content-crossfade flex-1 min-h-0 flex flex-col">
                <ClienteDetalleContent
                  cliente={clienteSeleccionado}
                  derivado={derivadoSeleccionado}
                  reservas={reservas}
                  pagosPorReserva={pagosPorReserva}
                  todosPagos={todosPagos}
                  puedeAjustarPrecio={puedeAjustarPrecio}
                  onClose={handleCloseDetalle}
                  onEditar={() => handleOpenEdit(clienteSeleccionado)}
                  onEliminar={() => setClienteAEliminar(clienteSeleccionado)}
                  onRegistrarPago={() => setPagoCliente(clienteSeleccionado)}
                  onPagoCelda={setPagoCelda}
                  onDefinirPrecio={(reserva) => { setConfirmarValorTotal(0); setConfirmarReserva({ reserva, cliente: clienteSeleccionado }) }}
                  onEditarPrecio={(reserva) => { setConfirmarValorTotal(Number(reserva.valor_total) || 0); setConfirmarReserva({ reserva, cliente: clienteSeleccionado }) }}
                  onAgruparReservas={() => handleAbrirAgrupar(clienteSeleccionado)}
                  onLiberarUnidad={handleLiberarUnidad}
                  onConfirmarTemporada={(reserva) => { setConfirmarValorTotal(0); setConfirmarReserva({ reserva, cliente: clienteSeleccionado }) }}
                  wide
                />
              </div>
            ) : (
              <div key="empty" className="content-crossfade flex-1 flex flex-col items-center justify-center text-center gap-3 text-prius-muted">
                <LayoutList size={28} />
                <p className="text-body-md">Elegí un cliente para ver la ficha</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Tablet (768-1023px): mismo detalle, como bottom sheet. */}
      {!isMobile && !isDesktopLG && (
        <BottomSheet isOpen={!!clienteSeleccionado} onClose={handleCloseDetalle} maxHeightClass="max-h-[88vh]">
          {clienteSeleccionado && (
            <ClienteDetalleContent
              cliente={clienteSeleccionado}
              derivado={derivadoSeleccionado}
              reservas={reservas}
              pagosPorReserva={pagosPorReserva}
              todosPagos={todosPagos}
              puedeAjustarPrecio={puedeAjustarPrecio}
              onClose={handleCloseDetalle}
              onEditar={() => handleOpenEdit(clienteSeleccionado)}
              onEliminar={() => setClienteAEliminar(clienteSeleccionado)}
              onRegistrarPago={() => setPagoCliente(clienteSeleccionado)}
              onPagoCelda={setPagoCelda}
              onDefinirPrecio={(reserva) => { setConfirmarValorTotal(0); setConfirmarReserva({ reserva, cliente: clienteSeleccionado }) }}
              onEditarPrecio={(reserva) => { setConfirmarValorTotal(Number(reserva.valor_total) || 0); setConfirmarReserva({ reserva, cliente: clienteSeleccionado }) }}
              onAgruparReservas={() => handleAbrirAgrupar(clienteSeleccionado)}
              onLiberarUnidad={handleLiberarUnidad}
              onConfirmarTemporada={(reserva) => { setConfirmarValorTotal(0); setConfirmarReserva({ reserva, cliente: clienteSeleccionado }) }}
              showCloseButton={false}
            />
          )}
        </BottomSheet>
      )}

      {/* Mobile (<768px, mock 04-clientes-mobile-ficha): pantalla completa,
          vía portal a document.body — igual que BottomSheet.jsx. Necesario:
          el wrapper raíz de esta página usa `animate-premium-fade`, cuya
          animación deja un `transform` aplicado (fill-mode `both`) incluso
          después de terminar — eso convierte a ese wrapper en containing
          block de cualquier `position:fixed` anidado adentro (mismo bug
          documentado en CLAUDE.md para el portal del date picker), así que
          sin portal este overlay quedaba recortado a la altura del
          contenido scrolleable en vez de cubrir el viewport real. */}
      {isMobile && mobileDetalleShouldRender && createPortal(
        <div className={`fixed inset-0 z-[995] bg-white flex flex-col ${clienteSeleccionado ? 'ui-open' : 'ui-close'}`}>
          <div className="flex items-center gap-2 px-2 h-16 border-b border-hairline shrink-0">
            <button onClick={handleCloseDetalle} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-prius-slate hover:text-black">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-sm font-bold uppercase tracking-widest text-black">Ficha de Cliente</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-space-lg pt-space-md pb-space-lg flex flex-col min-h-0">
            {mobileDetalleCliente && (
              <ClienteDetalleContent
                cliente={mobileDetalleCliente}
                derivado={mobileDetalleDerivado}
                reservas={reservas}
                pagosPorReserva={pagosPorReserva}
                todosPagos={todosPagos}
                puedeAjustarPrecio={puedeAjustarPrecio}
                onClose={handleCloseDetalle}
                onEditar={() => handleOpenEdit(mobileDetalleCliente)}
                onEliminar={() => setClienteAEliminar(mobileDetalleCliente)}
                onRegistrarPago={() => setPagoCliente(mobileDetalleCliente)}
                onPagoCelda={setPagoCelda}
                onDefinirPrecio={(reserva) => { setConfirmarValorTotal(0); setConfirmarReserva({ reserva, cliente: mobileDetalleCliente }) }}
                onEditarPrecio={(reserva) => { setConfirmarValorTotal(Number(reserva.valor_total) || 0); setConfirmarReserva({ reserva, cliente: mobileDetalleCliente }) }}
                onAgruparReservas={() => handleAbrirAgrupar(mobileDetalleCliente)}
                onLiberarUnidad={handleLiberarUnidad}
                onConfirmarTemporada={(reserva) => { setConfirmarValorTotal(0); setConfirmarReserva({ reserva, cliente: mobileDetalleCliente }) }}
                showCloseButton={false}
              />
            )}
          </div>
        </div>,
        document.body,
      )}


      {/* Create / Edit Modal — misma estética que "Nueva Reserva" (oct 2026):
          mismo Modal.jsx (bottom sheet mobile / centrado desktop, header
          dorado espaciado + X ya los da el componente), etiquetas de sección
          con línea divisoria, footer sticky con Cancelar + submit siempre
          visibles sin scroll. Mismos campos/validaciones/lógica de alta de
          siempre — solo JSX/clases. */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-prius-slate bg-prius-subtle hover:bg-prius-subtle border border-hairline transition-all"
            >
              Cancelar
            </button>
            <LoadingButton
              type="submit"
              form="form-cliente"
              loading={savingCliente}
              loadingText="Guardando..."
              className="px-6 py-3 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs shadow-xl"
            >
              {editingCliente ? 'Guardar Cambios' : 'Registrar Cliente'}
            </LoadingButton>
          </div>
        }
      >
        <form id="form-cliente" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <p className="text-[9px] font-bold text-prius-muted uppercase tracking-[0.2em] border-b border-hairline pb-2">Cliente</p>
            <TextInput
              label="Nombre Completo"
              required
              value={nombre}
              onChange={(v) => setNombre(v.replace(/[´`]/g, "'").toUpperCase())}
              maxLength={120}
              placeholder="Ej. JUAN PÉREZ"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhoneInput
                label="Teléfono" required value={telefono} onChange={setTelefono}
                onBlur={() => setTelefonoTocado(true)}
                error={telefonoTocado && clienteFormErrors.telefono ? 'Ingresá un teléfono válido' : undefined}
              />
              <DniInput
                label="DNI (opcional)" value={dni} onChange={setDni}
                error={dni && clienteFormErrors.dni ? clienteFormErrors.dni : undefined}
              />
            </div>
            <TextInput
              label="Email" type="email" value={mail} onChange={(v) => setMail(v.toLowerCase())}
              placeholder="cliente@email.com" error={mail && clienteFormErrors.mail ? clienteFormErrors.mail : undefined}
            />
          </div>

          <div className="space-y-5">
            <p className="text-[9px] font-bold text-prius-muted uppercase tracking-[0.2em] border-b border-hairline pb-2">Datos fiscales</p>
            <SelectChips
              label="Condición IVA"
              required
              value={condicionIva}
              onChange={setCondicionIva}
              options={[
                { value: 'consumidor_final', label: 'Consumidor Final' },
                { value: 'monotributo', label: 'Monotributo' },
                { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
                { value: 'exento', label: 'Exento' },
              ]}
            />
            <CuitInput
              label={requiereCuit ? 'CUIT' : 'CUIT (opcional)'}
              required={requiereCuit}
              value={cuit}
              onChange={setCuit}
              error={cuit.length === 11 && !cuitFormularioValido ? 'CUIT inválido' : undefined}
            />
            {condicionIva === 'responsable_inscripto' && (
              <TextInput
                label="Razón Social"
                required
                value={razonSocial}
                onChange={setRazonSocial}
                maxLength={120}
                error={razonSocial && !razonSocialValida ? 'Entre 2 y 120 caracteres' : undefined}
              />
            )}
          </div>

          <div className="space-y-5">
            <p className="text-[9px] font-bold text-prius-muted uppercase tracking-[0.2em] border-b border-hairline pb-2">Notas</p>
            <TextInput
              as="textarea"
              label="Notas / Comentarios"
              rows={3}
              value={notas}
              onChange={setNotas}
              maxLength={500}
              placeholder="Comentarios adicionales..."
            />
          </div>

          {/* Alta de temporada opcional, solo al crear (no al editar) — el
              mismo formulario se reutiliza en el modal standalone de abajo
              para clientes ya existentes. */}
          {!editingCliente && (
            <div className="space-y-5">
              <p className="text-[9px] font-bold text-prius-muted uppercase tracking-[0.2em] border-b border-hairline pb-2">Reserva de temporada (opcional)</p>
              <label className="flex items-center gap-2 text-xs text-prius-slate cursor-pointer">
                <input
                  type="checkbox"
                  checked={agregarTemporadaNueva}
                  onChange={(e) => setAgregarTemporadaNueva(e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
                Agregar reserva de temporada para este cliente ahora
              </label>

              {agregarTemporadaNueva && (
                <div ref={revealTemporadaNuevaRef} className="animate-premium-fade space-y-4 pl-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Unidad</label>
                      <BrandSelect value={tUnidadId} onChange={setTUnidadId} options={opcionesUnidadTemporada} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Temporada</label>
                      <p className={`${inputClass} text-prius-slate`}>{temporadaActiva?.nombre || '—'}</p>
                    </div>
                  </div>
                  {puedeBonificar && (
                    <div className="flex items-center justify-between p-3 bg-prius-subtle border border-hairline rounded-xl">
                      <label htmlFor="cliente-temporada-bonificada" className="text-[10px] font-bold text-prius-slate uppercase tracking-widest cursor-pointer">
                        Unidad bonificada
                      </label>
                      <input
                        id="cliente-temporada-bonificada"
                        type="checkbox"
                        checked={tBonificada}
                        onChange={(e) => setTBonificada(e.target.checked)}
                        className="accent-gold w-4 h-4 cursor-pointer"
                      />
                    </div>
                  )}
                  <MoneyInput
                    label="Monto Total"
                    value={tBonificada ? 0 : tValorTotal}
                    onChange={setTValorTotal}
                    disabled={tBonificada}
                    max={100_000_000}
                    hint={tBonificada ? 'Carpa bonificada: sin cargo, no registra pagos.' : undefined}
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Notas de la reserva</label>
                    <textarea
                      rows={2}
                      value={tNotas}
                      onChange={(e) => setTNotas(e.target.value)}
                      className={`${inputClass} resize-none font-normal normal-case`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Acción primaria "Confirmar temporada" (pendiente_confirmacion) /
          "Definir precio" (reserva confirmada sin monto cargado) — mismo
          formulario, solo cambia valor_total; el trigger recalcula
          estado_pago/saldo solo. */}
      <Modal
        isOpen={!!confirmarReserva}
        onClose={() => setConfirmarReserva(null)}
        title={
          confirmarReserva?.reserva && esPendienteConfirmacion(confirmarReserva.reserva)
            ? 'Confirmar Temporada'
            : Number(confirmarReserva?.reserva?.valor_total) > 0
              ? 'Editar Monto'
              : 'Definir Precio'
        }
      >
        <form onSubmit={handleSubmitConfirmarReserva} className="space-y-6">
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Cliente</p>
            <p className="text-sm text-black font-bold uppercase mt-1">{confirmarReserva?.cliente?.nombre}</p>
          </div>
          <MoneyInput label="Monto Total" value={confirmarValorTotal} onChange={setConfirmarValorTotal} required max={100_000_000} />
          <button
            type="submit"
            disabled={savingConfirmacion}
            className="w-full py-4 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {savingConfirmacion ? 'Guardando...' : 'Confirmar'}
          </button>
        </form>
      </Modal>

      {/* Registrar Pago (Tarea 4) — mismo componente que usa Reservas y el Plano.
          reservasOptions incluye también las reservas donde `pagoCliente` es
          CO-SOCIO (no titular): un cosocio puede pagar su parte de la unidad
          compartida — el pago queda con cliente_id del cosocio y reserva_id
          de la reserva compartida (registrar_pago ya admite esa combinación,
          el saldo que valida es el de la reserva, no el del titular). No se
          mezcla con `reservasPorCliente` en ningún otro lado (saldo del
          header, PagosGrid) a propósito, ver reservasComoCoSocioPorCliente. */}
      <RegistrarPago
        isOpen={!!pagoCliente}
        onClose={() => setPagoCliente(null)}
        cliente={pagoCliente}
        reservasOptions={
          pagoCliente
            ? [
                ...(reservasPorCliente[pagoCliente.id] || []),
                ...(reservasComoCoSocioPorCliente[pagoCliente.id] || []),
              ].filter((r) => r.estado !== 'cancelada' && !r.bonificada)
            : []
        }
      />

      {/* Disparado desde una celda de PagosGrid: reserva ya fija. Si la celda
          tenía un pago cargado, se abre en modo consulta (DetallePago); si
          era la celda "+ Cargar", se abre el alta (RegistrarPago). Oct 2026
          (`editando`): "Cargar monto" desde DetallePago reusa esta MISMA
          instancia en modo edición (UPDATE, nunca alta nueva) — con
          `secuencia` activa (notificación "Recibos sin monto asignado (N)"),
          recorre los recibos sin monto de la reserva uno por uno. */}
      <RegistrarPago
        isOpen={!!pagoCelda && (!pagoCelda.pago || pagoCelda.editando)}
        onClose={() => setPagoCelda(null)}
        cliente={pagoCelda?.reserva?.clientes}
        reservasOptions={pagoCelda ? [pagoCelda.reserva] : []}
        initialReservaId={pagoCelda?.reserva?.id || ''}
        allowSinReserva={false}
        editingPago={pagoCelda?.editando ? (todosPagos.find((p) => p.id === pagoCelda.pago.id) || pagoCelda.pago) : null}
        tituloOverride={
          pagoCelda?.secuencia
            ? `Recibo ${pagoCelda.secuencia.idx + 1} de ${pagoCelda.secuencia.pagos.length}`
            : pagoCelda?.editando ? 'Cargar monto' : undefined
        }
        onSuccess={() => {
          setPagoCelda((prev) => {
            if (!prev) return null
            const sec = prev.secuencia
            if (!sec) return null
            if (sec.idx + 1 < sec.pagos.length) {
              const nextIdx = sec.idx + 1
              return { ...prev, pago: sec.pagos[nextIdx], secuencia: { ...sec, idx: nextIdx } }
            }
            return { ...prev, secuencia: null }
          })
        }}
      />
      <DetallePago
        isOpen={!!pagoCelda && !!pagoCelda.pago && !pagoCelda.editando}
        onClose={() => setPagoCelda(null)}
        pago={pagoCelda?.pago ? todosPagos.find((p) => p.id === pagoCelda.pago.id) || pagoCelda.pago : null}
        reserva={pagoCelda?.reserva}
        autoAbrirMonto={!!pagoCelda?.autoAbrirMonto}
        onEditarMonto={(pago) => setPagoCelda((prev) => (prev ? { ...prev, pago, editando: true, secuencia: null } : null))}
      />

      {/* Agrupar reservas sueltas bajo un precio unificado (caso Ana Lescano) */}
      <Modal
        isOpen={!!agruparCliente}
        onClose={() => setAgruparCliente(null)}
        title={`Agrupar Reservas — ${agruparCliente?.nombre || ''}`}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">
              Elegí 2 o más períodos para unificar bajo un solo precio total
            </p>
            <div className="space-y-2">
              {(reservasPorCliente[agruparCliente?.id] || [])
                .filter((r) => !r.grupo_id && r.estado !== 'cancelada')
                .map((r) => (
                  <label key={r.id} className="flex items-center gap-3 p-3 bg-prius-subtle border border-hairline rounded-xl text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agruparSeleccion.has(r.id)}
                      onChange={() => handleToggleSeleccionGrupo(r.id)}
                      className="accent-cyan-400 w-4 h-4"
                    />
                    <span className="text-prius-slate">
                      {unidadEmoji(r.unidades?.tipo)} {formatUnidad(r.unidades?.tipo, r.unidades?.numero)} ·{' '}
                      {r.tipo_alquiler === 'dia' ? formatFecha(r.fecha) : `${formatFecha(r.fecha_inicio)} — ${formatFecha(r.fecha_fin)}`}
                    </span>
                  </label>
                ))}
            </div>
          </div>
          <MoneyInput label="Precio Total del Grupo" value={agruparPrecioTotal} onChange={setAgruparPrecioTotal} max={100_000_000} required />
          <TextInput label="Temporada (opcional)" value={agruparTemporada} onChange={setAgruparTemporada} maxLength={40} />
          <button
            type="button"
            disabled={agruparSeleccion.size < 2 || !agruparPrecioTotal || savingGrupo}
            onClick={handleCrearGrupo}
            className="w-full py-4 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {savingGrupo ? 'Agrupando...' : 'Agrupar y Definir Precio'}
          </button>
        </div>
      </Modal>

      <ConfirmarSuperadminModal
        isOpen={!!clienteAEliminar}
        onClose={() => setClienteAEliminar(null)}
        onConfirm={handleConfirmDeleteCliente}
        titulo="Eliminar cliente"
        afectaLinea={`${clienteAEliminar?.nombre || 'Este cliente'} — sus reservas no se borran, quedan sin cliente asociado.`}
        confirmLabel="Eliminar definitivamente"
      />

      <ScrollToTopButton />
    </div>
  )
}

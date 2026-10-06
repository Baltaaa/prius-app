import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClientes } from '../../hooks/useClientes'
import { useReservas } from '../../hooks/useReservas'
import { usePagos } from '../../hooks/usePagos'
import { useDebounced } from '../../hooks/useDebounced'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { formatPesosVisible, formatFecha, formatCUIT, formatDNI, formatTelefono, unidadEmoji, formatComprobante } from '../../lib/format'
import { cuitValido, parseDNI, parseUnidadQuery, normalizarNumeroComprobante } from '../../lib/parse'
import { scrollAndHighlight } from '../../lib/highlight'
import { validarClienteForm, requiereCuitClienteForm } from '../../lib/validators/cliente'
import {
  coSocios, saldoNumerico, esPendienteConfirmacion, montoInfo, estadoBadgeStatus,
  esGrupo, reservasDelGrupo, saldoGrupo, estadoPagoGrupo,
} from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import Modal from '../../components/crm/Modal'
import RegistrarPago from '../../components/crm/RegistrarPago'
import DetallePago from '../../components/crm/DetallePago'
import PagosGrid from '../../components/crm/PagosGrid'
import Historial from '../../components/crm/Historial'
import ScrollToTopButton from '../../components/crm/ScrollToTopButton'
import MoneyInput from '../../components/inputs/MoneyInput'
import TextInput from '../../components/inputs/TextInput'
import PhoneInput from '../../components/inputs/PhoneInput'
import DniInput from '../../components/inputs/DniInput'
import CuitInput from '../../components/inputs/CuitInput'
import SelectChips from '../../components/inputs/SelectChips'
import SearchInput from '../../components/inputs/SearchInput'
import BrandSelect from '../../components/ui/BrandSelect'
import StatusBadge from '../../components/crm/StatusBadge'
import ConfirmDeleteModal from '../../components/crm/ConfirmDeleteModal'
import { Plus, Edit2, Trash2, Wallet, ChevronDown, Mail, Phone, FileText, CircleDollarSign, Filter, Check } from 'lucide-react'

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
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-cyan-400/50 outline-none font-bold'

const TIPO_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día' }

// Unidades únicas asociadas a un cliente a partir de sus reservas (co-socio en
// varias unidades, o histórico de varias temporadas: puede haber más de una).
const unidadesDeReservas = (reservasCliente) => {
  const vistas = new Set()
  const out = []
  for (const r of reservasCliente) {
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
  const { clientes, loading, createCliente, updateCliente, deleteCliente } = useClientes()
  const {
    reservas, unidades, temporadaActiva, loading: resLoading, createReserva, updateReserva, crearGrupoReservas,
  } = useReservas()
  const { pagos: todosPagos } = usePagos() // sin reservaId: historial completo, filtrado acá por cliente

  const GRUPO_UNIDAD_CLIENTES = { carpa: 'Carpas', sombrilla: 'Sombrillas', cabina: 'Cabinas', locker: 'Lockers' }
  const opcionesUnidadTemporada = useMemo(
    () =>
      [...unidades]
        .sort((a, b) => (GRUPO_UNIDAD_CLIENTES[a.tipo] || a.tipo).localeCompare(GRUPO_UNIDAD_CLIENTES[b.tipo] || b.tipo) || a.numero - b.numero)
        .map((u) => ({ value: u.id, group: GRUPO_UNIDAD_CLIENTES[u.tipo] || u.tipo, label: `${unidadEmoji(u.tipo)} ${u.tipo} #${u.numero}` })),
    [unidades],
  )
  const puedeBonificar = usePermiso('bonificar')
  const [searchParams, setSearchParams] = useSearchParams()
  const { alert } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [showFiltros, setShowFiltros] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [pagoCliente, setPagoCliente] = useState(null)
  const [pagoCelda, setPagoCelda] = useState(null) // { reserva, pago } | null — click en PagosGrid
  const [expandedId, setExpandedId] = useState(null) // un solo cliente expandido a la vez

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
    setDni(cliente.dni || '')
    setCuit(cliente.cuit || '')
    setCondicionIva(cliente.condicion_iva || 'consumidor_final')
    setRazonSocial(cliente.razon_social || '')
    setMail(cliente.mail || '')
    setNotas(cliente.notas || '')
    setIsModalOpen(true)
  }

  const requiereCuit = requiereCuitClienteForm(condicionIva)
  const clienteFormErrors = validarClienteForm({ nombre, telefono, condicionIva, cuit, mail }, razonSocial)
  const cuitFormularioValido = !clienteFormErrors.cuit
  const razonSocialValida = !clienteFormErrors.razonSocial

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (Object.keys(clienteFormErrors).length > 0) return
    const payload = {
      nombre: nombre.toUpperCase(), telefono, dni: dni || null, cuit: cuit || null,
      condicion_iva: condicionIva, razon_social: razonSocial || null, mail, notas,
    }
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
    } catch (err) {
      await alert('Error guardando cliente.')
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

  const handleConfirmDeleteCliente = async () => {
    if (!clienteAEliminar) return
    try {
      await deleteCliente(clienteAEliminar.id)
      setClienteAEliminar(null)
    } catch (err) {
      await alert('No se pudo borrar el cliente.')
    }
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
    params: ['id', 'pago', 'reserva'],
    ready: !loading,
    resolve: ({ id, pago, reserva }) => {
      const cliente = clientes.find((c) => c.id === id)
      if (!cliente) return null
      setExpandedId(cliente.id)
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

  // Filtro por estado (badge): mismo criterio que el badge del header de cada
  // fila — un grupo con precio unificado manda por sobre cualquier período
  // suelto, igual que en el render.
  const clientesVisibles = useMemo(() => {
    if (filtroEstado === 'todos') return filteredClientes
    return filteredClientes.filter((cliente) => {
      const reservasCliente = reservasPorCliente[cliente.id] || []
      const grupo = reservasCliente.find((r) => esGrupo(r) && r.estado !== 'cancelada')
      if (grupo) {
        return estadoPagoGrupo(saldoGrupo(grupo, reservas, pagosPorReserva), grupo.reserva_grupos) === filtroEstado
      }
      const badge = reservaActivaDeTemporada(reservasCliente)
      return badge ? estadoBadgeStatus(badge) === filtroEstado : false
    })
  }, [filteredClientes, filtroEstado, reservasPorCliente, reservas, pagosPorReserva])

  // Saldo total por cliente: SIEMPRE derivado de estado_pago + pagos reales
  // (saldoNumerico), nunca del campo suelto `reserva.saldo` — para temporada
  // migrada del excel histórico ese campo quedó siempre vacío/"$-", no es un
  // valor calculado real (bug detectado con AGUSTIN, Sombrilla #27: badge
  // "PARCIAL" + "Unidad saldada" al mismo tiempo). Si algún cliente tiene una
  // reserva con saldo sin verificar (precio ambiguo o pago sin verificar), el
  // total completo se marca `sinVerificar` — sumar un número real más un
  // "no sabemos cuánto" daría un total falso.
  const saldoPorCliente = useMemo(() => {
    const map = {}
    const gruposContados = new Set()
    for (const r of reservas) {
      if (r.estado === 'cancelada' || !r.cliente_id) continue
      const entry = (map[r.cliente_id] ||= { total: 0, sinVerificar: false })
      // Una reserva agrupada (precio unificado, ver lib/reservas.js) no suma
      // su propio saldo individual — el grupo entero cuenta UNA sola vez,
      // contra precio_total, nunca contra valor_total de cada período suelto.
      if (esGrupo(r)) {
        if (gruposContados.has(r.grupo_id)) continue
        gruposContados.add(r.grupo_id)
        const saldo = saldoGrupo(r, reservas, pagosPorReserva)
        if (saldo === null) entry.sinVerificar = true
        else entry.total += saldo
        continue
      }
      const saldo = saldoNumerico(r, pagosPorReserva[r.id] || [])
      if (saldo === null) entry.sinVerificar = true
      else entry.total += saldo
    }
    return map
  }, [reservas, pagosPorReserva])

  // Reservas donde el cliente aparece como CO-SOCIO (reserva_clientes) sin ser
  // el titular (r.cliente_id) — solo para el badge de unidad de la cabecera:
  // un co-socio de la Sombrilla 17 tiene que ver esa unidad igual que el
  // titular, aunque no sea el dueño de la reserva. No se mezcla con
  // reservasPorCliente (saldo, lista de "Reservas", PagosGrid) para no
  // duplicar saldo/pagos que le corresponden al titular.
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

  if (loading || resLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Cargando Clientes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Toolbar: buscador + alta, en una sola fila pegada al navbar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nombre, DNI, CUIT o unidad (ej. carpa 19)..."
          className="flex-1 max-w-md"
          inputClassName="focus:border-cyan-400/50 py-3"
        />
        <div className="relative">
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`glass-card px-4 py-3 rounded-xl flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest ${filtroEstado !== 'todos' ? 'text-[#FDE047]' : 'text-gray-400 hover:text-white'}`}
          >
            <Filter size={16} /> {filtroEstado !== 'todos' ? FILTROS_ESTADO_CLIENTE.find((f) => f.value === filtroEstado)?.label : 'Estado'}
          </button>
          {showFiltros && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFiltros(false)} />
              <div className="absolute left-0 mt-2 w-48 glass-card rounded-xl overflow-hidden z-50 p-3">
                {FILTROS_ESTADO_CLIENTE.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => { setFiltroEstado(f.value); setShowFiltros(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center justify-between rounded-lg"
                  >
                    {f.label}
                    {filtroEstado === f.value && <Check size={14} className="text-[#FDE047]" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleOpenCreate}
          className="sm:ml-auto bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl shrink-0"
        >
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Directorio: filas-tarjeta expandibles, NO una tabla */}
      {clientesVisibles.length === 0 ? (
        <div className="p-12 text-center text-sm tracking-wider text-gray-500 glass-card rounded-xl">
          No se encontraron clientes.
        </div>
      ) : (
        <div className="space-y-3">
          {clientesVisibles.map((cliente) => {
            const reservasCliente = reservasPorCliente[cliente.id] || []
            const saldoInfo = saldoPorCliente[cliente.id] || { total: 0, sinVerificar: false }
            const isExpanded = expandedId === cliente.id
            const unidadesCliente = unidadesDeReservas([
              ...reservasCliente,
              ...(reservasComoCoSocioPorCliente[cliente.id] || []),
            ])
            // Un grupo con precio unificado (Ana Lescano) manda por sobre
            // cualquier período suelto para el badge/saldo del header — es la
            // imagen más completa del cliente.
            const reservaGrupoCliente = reservasCliente.find((r) => esGrupo(r) && r.estado !== 'cancelada')
            const reservaBadge = reservaGrupoCliente || reservaActivaDeTemporada(reservasCliente)
            const sinPrecio = !reservaGrupoCliente && precioSinDefinir(reservasCliente)
            // Reservas sobre las que tiene sentido ofrecer "Registrar pago"
            // desde acá — las bonificadas nunca admiten pagos (bloqueado a
            // nivel base), así que quedan afuera de las opciones del modal.
            const reservasPagables = reservasCliente.filter((r) => r.estado !== 'cancelada' && !r.bonificada)
            const badgeStatus = reservaGrupoCliente
              ? estadoPagoGrupo(saldoGrupo(reservaGrupoCliente, reservas, pagosPorReserva), reservaGrupoCliente.reserva_grupos)
              : (reservaBadge ? estadoBadgeStatus(reservaBadge) : null)
            // Exception del saldo "Monto nulo" (Tarea 3.2): si la reserva que
            // manda el badge del header ya está pagada o bonificada, el saldo
            // agregado en $0 es real (saldado), no un monto sin verificar.
            const saldoHeaderSaldado = reservaGrupoCliente
              ? badgeStatus === 'pagado'
              : reservaBadge && (reservaBadge.estado_pago === 'pagado' || reservaBadge.bonificada)

            // Reservas con precio unificado (ver lib/reservas.js) se sacan de
            // la lista suelta y se agrupan por grupo_id — cada grupo renderiza
            // UN solo bloque (precio_total/pagado/saldo arriba, períodos y
            // pagos abajo) en vez de una fila + PagosGrid por período.
            const reservasSueltas = reservasCliente.filter((r) => !r.grupo_id)
            // Ítem 4: cuántos comprobantes de este cliente todavía no tienen
            // monto cargado (muchos vienen así de la migración del Excel).
            const comprobantesPendientesCliente = todosPagos
              .filter((p) => p.cliente_id === cliente.id)
              .flatMap((p) => p.comprobantes || [])
              .filter((c) => c.monto_total == null).length
            const gruposCliente = {}
            for (const r of reservasCliente) {
              if (r.grupo_id) (gruposCliente[r.grupo_id] ||= []).push(r)
            }

            return (
              <div
                key={cliente.id}
                data-cliente-id={cliente.id}
                data-deeplink-id={cliente.id}
                className={`glass-card rounded-xl overflow-hidden border transition-all ${isExpanded ? 'border-cyan-400/40' : 'border-white/10'}`}
              >
                {/* Toda la caja es clickeable para expandir/colapsar. Mobile
                    (Tarea 4.7): dos líneas explícitas — nombre/unidad arriba,
                    badge/saldo/acciones abajo. `sm:contents` hace que ambos
                    grupos desaparezcan como contenedor a partir de `sm` y sus
                    hijos vuelvan a la misma fila flex-wrap de siempre, sin
                    duplicar el layout de desktop. */}
                <div
                  onClick={() => handleToggleExpand(cliente.id, isExpanded)}
                  className="w-full text-left px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-6 gap-y-2 cursor-pointer hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-3 sm:contents">
                    <ChevronDown
                      size={18}
                      className={`text-cyan-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                    <div className="min-w-[160px]">
                      <p className="font-bold text-white uppercase truncate">{cliente.nombre}</p>
                      <p className="text-gray-300 text-xs mt-0.5 flex items-center gap-1.5">
                        <Phone size={11} className="text-gray-600 shrink-0" />
                        {cliente.telefono ? formatTelefono(cliente.telefono) : <span className="text-gray-500">Sin cargar</span>}
                      </p>
                      {/* Línea extra cuando el match de búsqueda fue por
                          número de comprobante, no por nombre (Tarea 3, oct
                          2026) — salta directo a esa cuota resaltada. */}
                      {comprobanteMatchPorCliente[cliente.id] && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId(cliente.id)
                            scrollAndHighlight(`pago-${comprobanteMatchPorCliente[cliente.id].pago.id}`)
                          }}
                          className="text-[10px] text-[#FDE047] font-bold mt-1 hover:underline truncate block"
                        >
                          Comprobante {formatComprobante(comprobanteMatchPorCliente[cliente.id].comprobante.tipo, comprobanteMatchPorCliente[cliente.id].comprobante.numero)}
                          {formatPesosVisible(comprobanteMatchPorCliente[cliente.id].pago.monto) ? ` · ${formatPesosVisible(comprobanteMatchPorCliente[cliente.id].pago.monto)}` : ''}
                          {comprobanteMatchPorCliente[cliente.id].comprobante.fecha ? ` · ${formatFecha(comprobanteMatchPorCliente[cliente.id].comprobante.fecha)}` : ''}
                        </button>
                      )}
                    </div>
                    <div
                      className="flex items-baseline gap-2 flex-wrap min-w-[90px]"
                      title={unidadesCliente.map((u) => `${unidadEmoji(u.tipo)} ${u.tipo} #${u.numero}`).join(', ')}
                    >
                      {unidadesCliente.length === 0 ? (
                        <span className="text-[11px] text-gray-500 font-bold tracking-widest">Sin unidad</span>
                      ) : (
                        <>
                          {unidadesCliente.slice(0, MAX_UNIDADES_VISIBLES).map((u, i) => (
                            <span key={u.id ?? i} className="flex items-baseline gap-1 leading-none">
                              <span className="text-base leading-none">{unidadEmoji(u.tipo)}</span>
                              <span className="text-base font-extrabold text-white leading-none">{u.numero}</span>
                            </span>
                          ))}
                          {unidadesCliente.length > MAX_UNIDADES_VISIBLES && (
                            <span className="text-[10px] text-gray-500 font-bold tracking-widest">
                              +{unidadesCliente.length - MAX_UNIDADES_VISIBLES}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:contents">
                    {badgeStatus && <StatusBadge status={badgeStatus} />}
                    <div className="flex-1" />
                    {/* Columna fija: siempre a la misma distancia del borde,
                        sin importar el largo de unidad/badge de cada fila. */}
                    <p className="w-28 text-right shrink-0">
                      {saldoInfo.sinVerificar ? (
                        // Si la reserva que manda el badge ya está pagada o
                        // bonificada, ese "sin verificar" agregado no es una
                        // deuda real — nunca se muestra $0 acá, así que no se
                        // muestra nada (ver CLAUDE.md "Nunca $0").
                        saldoHeaderSaldado ? null : (
                          <span className="text-red-400 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Monto nulo</span>
                        )
                      ) : sinPrecio ? (
                        <span className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Sin precio</span>
                      ) : (
                        formatPesosVisible(saldoInfo.total) && (
                          <span className="font-bold text-sm text-red-400">{formatPesosVisible(saldoInfo.total)}</span>
                        )
                      )}
                    </p>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setPagoCliente(cliente)}
                        disabled={reservasPagables.length === 0}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-green-400 transition-all"
                        title="Registrar pago"
                      >
                        <Wallet size={16} />
                      </button>
                      <button onClick={() => handleOpenEdit(cliente)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg text-[#FDE047] transition-all" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setClienteAEliminar(cliente)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-red-500/10 rounded-lg text-red-400 transition-all" title="Borrar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sección expandida — inline, sin modal ni ruta nueva */}
                {isExpanded && (
                  <div className="border-t border-cyan-400/20 bg-black/20 px-6 py-6 space-y-6">
                    {/* Solo datos que NO se ven ya en el header (teléfono y
                        unidad quedan arriba) — evita la duplicación
                        detectada en auditoría. */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><Mail size={11} /> Email</p>
                        <p className="text-sm text-white mt-1 lowercase">{cliente.mail || <span className="text-gray-500 normal-case">Sin cargar</span>}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><FileText size={11} /> CUIT</p>
                        <p className="text-sm text-white mt-1">{cliente.cuit ? formatCUIT(cliente.cuit) : <span className="text-gray-500">Sin cargar</span>}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><FileText size={11} /> DNI</p>
                        <p className="text-sm text-white mt-1">{cliente.dni ? formatDNI(cliente.dni) : <span className="text-gray-500">Sin cargar</span>}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cliente desde</p>
                        <p className="text-sm text-white mt-1">{formatFecha(cliente.created_at)}</p>
                      </div>
                      {cliente.notas && (
                        <div className="col-span-2 md:col-span-4">
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Notas</p>
                          <p className="text-sm text-gray-300 mt-1">{cliente.notas}</p>
                        </div>
                      )}
                    </div>

                    {/* Grupos con precio unificado: un bloque por grupo,
                        arriba precio_total/pagado/saldo/estado, abajo cada
                        período y la lista de pagos con su comprobante — ver
                        CLAUDE.md / caso Ana Lescano. */}
                    {Object.entries(gruposCliente).map(([grupoId, reservasGrupo]) => {
                      const grupo = reservasGrupo[0].reserva_grupos
                      const saldo = saldoGrupo(reservasGrupo[0], reservas, pagosPorReserva)
                      const estado = estadoPagoGrupo(saldo, grupo)
                      const pagoGrupo = reservasGrupo.flatMap((r) => (pagosPorReserva[r.id] || []).map((p) => ({ ...p, __reserva: r })))
                        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
                      const pagado = Math.max(Number(grupo.precio_total || 0) - (saldo ?? 0), 0)
                      const primeraReservaActiva = reservasGrupo.find((r) => r.estado !== 'cancelada') || reservasGrupo[0]
                      return (
                        <div key={grupoId} className="px-4 py-4 bg-white/5 border border-cyan-400/20 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                              Reserva con precio unificado{grupo.temporada ? ` · ${grupo.temporada}` : ''}
                            </p>
                            {estado && <StatusBadge status={estado} />}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Precio total</p>
                              <p className="text-sm font-bold text-white mt-1">{formatPesosVisible(grupo.precio_total)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pagado</p>
                              <p className="text-sm font-bold text-green-400 mt-1">{formatPesosVisible(pagado)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Saldo</p>
                              <p className={`text-sm font-bold mt-1 ${saldo === null ? 'text-red-400' : saldo > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {saldo === null ? 'Monto nulo' : saldo > 0 ? formatPesosVisible(saldo) : 'Unidad saldada'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Períodos</p>
                            {reservasGrupo.map((r) => (
                              <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-300">
                                <span>{unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero}</span>
                                <span className="text-gray-500">
                                  {r.tipo_alquiler === 'dia' ? formatFecha(r.fecha) : `${formatFecha(r.fecha_inicio)} — ${formatFecha(r.fecha_fin)}`}
                                </span>
                                {r.estado === 'cancelada' && <span className="text-red-400 font-bold uppercase text-[10px]">Cancelada</span>}
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pagos</p>
                              <button
                                type="button"
                                onClick={() => setPagoCelda({ reserva: { ...primeraReservaActiva, clientes: cliente }, pago: null })}
                                className="text-[10px] font-bold uppercase tracking-widest text-green-400 hover:text-green-300 transition-all"
                              >
                                + Cargar pago
                              </button>
                            </div>
                            {pagoGrupo.length === 0 ? (
                              <p className="text-xs text-gray-500">Sin pagos registrados.</p>
                            ) : (
                              pagoGrupo.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setPagoCelda({ reserva: { ...p.__reserva, clientes: cliente }, pago: p })}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                    p.estado === 'anulado' ? 'bg-white/5 text-gray-600 line-through' : 'bg-white/5 text-white hover:bg-white/10'
                                  }`}
                                >
                                  <span>{formatFecha(p.fecha)}</span>
                                  <span className="font-bold">{p.monto == null ? 'Monto nulo' : formatPesosVisible(p.monto)}</span>
                                  <span className="text-gray-500">
                                    {p.comprobantes?.length > 0
                                      ? p.comprobantes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ')
                                      : 'Sin comprobante'}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Reservas sueltas: históricas y actuales, cualquier tipo */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          Reservas ({reservasSueltas.length})
                        </p>
                        {reservasSueltas.filter((r) => r.estado !== 'cancelada').length >= 2 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAbrirAgrupar(cliente) }}
                            className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all"
                          >
                            Agrupar reservas
                          </button>
                        )}
                      </div>
                      {reservasSueltas.length === 0 ? (
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Sin reservas sueltas.</p>
                      ) : (
                        <div className="space-y-2">
                          {reservasSueltas.map((r) => {
                            const socios = coSocios(r)
                            const fechas =
                              r.tipo_alquiler === 'temporada'
                                ? r.temporada
                                : r.tipo_alquiler === 'dia'
                                  ? formatFecha(r.fecha)
                                  : `${formatFecha(r.fecha_inicio)} — ${formatFecha(r.fecha_fin)}`
                            return (
                              <div key={r.id} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs space-y-1.5">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className="font-bold text-cyan-400 uppercase tracking-widest">{TIPO_LABEL[r.tipo_alquiler] || r.tipo_alquiler}</span>
                                  <span className="text-gray-300">{unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero}</span>
                                  <span className="text-gray-500">{fechas}</span>
                                  {r.estado === 'cancelada' && <span className="text-red-400 font-bold uppercase">Cancelada</span>}
                                  <div className="flex-1" />
                                  <StatusBadge status={estadoBadgeStatus(r)} />
                                  {r.estado !== 'cancelada' && !r.bonificada && esPendienteConfirmacion(r) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setConfirmarValorTotal(0)
                                        setConfirmarReserva({ reserva: r, cliente })
                                      }}
                                      className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all"
                                    >
                                      Confirmar temporada
                                    </button>
                                  )}
                                  {r.estado !== 'cancelada' && !r.bonificada && (r.estado_pago === 'parcial' || r.estado_pago === 'pendiente') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setPagoCelda({ reserva: { ...r, clientes: cliente }, pago: null })
                                      }}
                                      className="text-[10px] font-bold uppercase tracking-widest text-green-400 hover:text-green-300 transition-all"
                                    >
                                      Registrar pago
                                    </button>
                                  )}
                                </div>
                                {socios.length > 0 && (
                                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                    Co-socios: {socios.map((s) => s.nombre).join(', ')}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Grilla de pagos por reserva, estilo el cuadro Excel del
                        administrador: Precio de Venta | Mes 1..N | Saldo.
                        Una grilla por reserva (valor_total/saldo son de la
                        reserva, no del cliente). Reemplaza la lista plana de
                        historial que había antes. */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          Pagos por Reserva
                        </p>
                        {comprobantesPendientesCliente > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                            {comprobantesPendientesCliente} comprobante{comprobantesPendientesCliente > 1 ? 's' : ''} sin monto
                          </span>
                        )}
                      </div>
                      {reservasSueltas.length === 0 ? (
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Sin reservas sueltas — nada para cobrar acá (ver pagos del grupo arriba).</p>
                      ) : (
                        <div className="space-y-4">
                          {reservasSueltas.map((r) => (
                            <div key={r.id} data-deeplink-id={`reserva-${r.id}`}>
                              <PagosGrid
                                reserva={r}
                                pagos={todosPagos.filter((p) => p.reserva_id === r.id)}
                                onCellClick={(reserva, pago) =>
                                  setPagoCelda({ reserva: { ...reserva, clientes: cliente }, pago })
                                }
                                onDefinirPrecio={(reserva) => {
                                  setConfirmarValorTotal(0)
                                  setConfirmarReserva({ reserva, cliente })
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Historial del cliente — mismo componente que la
                        unidad del Plano y el detalle de reserva (ítem 2). */}
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Historial</p>
                      <Historial tipo="cliente" id={cliente.id} compact />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <TextInput
            label="Nombre Completo"
            required
            value={nombre}
            onChange={(v) => setNombre(v.replace(/[´`]/g, "'").toUpperCase())}
            maxLength={120}
            placeholder="Ej. JUAN PÉREZ"
          />

          <div className="grid grid-cols-2 gap-4">
            <PhoneInput label="Teléfono" required value={telefono} onChange={setTelefono} />
            <DniInput label="DNI (opcional)" value={dni} onChange={setDni} />
          </div>

          <TextInput
            label="Email" type="email" value={mail} onChange={(v) => setMail(v.toLowerCase())}
            placeholder="cliente@email.com" error={mail && clienteFormErrors.mail ? clienteFormErrors.mail : undefined}
          />

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

          <div className="grid grid-cols-2 gap-4">
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

          <TextInput
            as="textarea"
            label="Notas / Comentarios"
            rows={3}
            value={notas}
            onChange={setNotas}
            maxLength={500}
            placeholder="Comentarios adicionales..."
          />

          {/* Alta de temporada opcional, solo al crear (no al editar) — el
              mismo formulario se reutiliza en el modal standalone de abajo
              para clientes ya existentes. */}
          {!editingCliente && (
            <div className="space-y-4 border-t border-white/10 pt-6">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agregarTemporadaNueva}
                  onChange={(e) => setAgregarTemporadaNueva(e.target.checked)}
                  className="accent-cyan-400 w-4 h-4"
                />
                Agregar reserva de temporada para este cliente ahora
              </label>

              {agregarTemporadaNueva && (
                <div className="space-y-4 pl-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad</label>
                      <BrandSelect value={tUnidadId} onChange={setTUnidadId} options={opcionesUnidadTemporada} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
                      <p className={`${inputClass} text-gray-300`}>{temporadaActiva?.nombre || '—'}</p>
                    </div>
                  </div>
                  {puedeBonificar && (
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                      <label htmlFor="cliente-temporada-bonificada" className="text-[10px] font-bold text-gray-300 uppercase tracking-widest cursor-pointer">
                        Unidad bonificada
                      </label>
                      <input
                        id="cliente-temporada-bonificada"
                        type="checkbox"
                        checked={tBonificada}
                        onChange={(e) => setTBonificada(e.target.checked)}
                        className="accent-cyan-400 w-4 h-4 cursor-pointer"
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Notas de la reserva</label>
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

          <button
            type="submit"
            className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {editingCliente ? 'Guardar Cambios' : 'Registrar Cliente'}
          </button>
        </form>
      </Modal>

      {/* Acción primaria "Confirmar temporada" (pendiente_confirmacion) /
          "Definir precio" (reserva confirmada sin monto cargado) — mismo
          formulario, solo cambia valor_total; el trigger recalcula
          estado_pago/saldo solo. */}
      <Modal
        isOpen={!!confirmarReserva}
        onClose={() => setConfirmarReserva(null)}
        title={confirmarReserva?.reserva && esPendienteConfirmacion(confirmarReserva.reserva) ? 'Confirmar Temporada' : 'Definir Precio'}
      >
        <form onSubmit={handleSubmitConfirmarReserva} className="space-y-6">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliente</p>
            <p className="text-sm text-white font-bold uppercase mt-1">{confirmarReserva?.cliente?.nombre}</p>
          </div>
          <MoneyInput label="Monto Total" value={confirmarValorTotal} onChange={setConfirmarValorTotal} required max={100_000_000} />
          <button
            type="submit"
            disabled={savingConfirmacion}
            className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {savingConfirmacion ? 'Guardando...' : 'Confirmar'}
          </button>
        </form>
      </Modal>

      {/* Registrar Pago (Tarea 4) — mismo componente que usa Reservas y el Plano */}
      <RegistrarPago
        isOpen={!!pagoCliente}
        onClose={() => setPagoCliente(null)}
        cliente={pagoCliente}
        reservasOptions={
          pagoCliente
            ? (reservasPorCliente[pagoCliente.id] || []).filter((r) => r.estado !== 'cancelada' && !r.bonificada)
            : []
        }
      />

      {/* Disparado desde una celda de PagosGrid: reserva ya fija. Si la celda
          tenía un pago cargado, se abre en modo consulta (DetallePago); si
          era la celda "+ Cargar", se abre el alta (RegistrarPago). */}
      <RegistrarPago
        isOpen={!!pagoCelda && !pagoCelda.pago}
        onClose={() => setPagoCelda(null)}
        cliente={pagoCelda?.reserva?.clientes}
        reservasOptions={pagoCelda ? [pagoCelda.reserva] : []}
        initialReservaId={pagoCelda?.reserva?.id || ''}
        allowSinReserva={false}
      />
      <DetallePago
        isOpen={!!pagoCelda && !!pagoCelda.pago}
        onClose={() => setPagoCelda(null)}
        pago={pagoCelda?.pago ? todosPagos.find((p) => p.id === pagoCelda.pago.id) || pagoCelda.pago : null}
        reserva={pagoCelda?.reserva}
      />

      {/* Agrupar reservas sueltas bajo un precio unificado (caso Ana Lescano) */}
      <Modal
        isOpen={!!agruparCliente}
        onClose={() => setAgruparCliente(null)}
        title={`Agrupar Reservas — ${agruparCliente?.nombre || ''}`}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Elegí 2 o más períodos para unificar bajo un solo precio total
            </p>
            <div className="space-y-2">
              {(reservasPorCliente[agruparCliente?.id] || [])
                .filter((r) => !r.grupo_id && r.estado !== 'cancelada')
                .map((r) => (
                  <label key={r.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agruparSeleccion.has(r.id)}
                      onChange={() => handleToggleSeleccionGrupo(r.id)}
                      className="accent-cyan-400 w-4 h-4"
                    />
                    <span className="text-gray-300">
                      {unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero} ·{' '}
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
            className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {savingGrupo ? 'Agrupando...' : 'Agrupar y Definir Precio'}
          </button>
        </div>
      </Modal>

      <ConfirmDeleteModal
        isOpen={!!clienteAEliminar}
        onClose={() => setClienteAEliminar(null)}
        onConfirm={handleConfirmDeleteCliente}
        tipo="cliente"
        identificador={clienteAEliminar?.nombre || ''}
        detalle="Sus reservas no se borran: quedan sin cliente asociado."
      />

      <ScrollToTopButton />
    </div>
  )
}

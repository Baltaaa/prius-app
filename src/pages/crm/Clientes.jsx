import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClientes } from '../../hooks/useClientes'
import { useReservas } from '../../hooks/useReservas'
import { usePagos } from '../../hooks/usePagos'
import { useDebounced } from '../../hooks/useDebounced'
import { formatMontoVisible, formatDate, unidadEmoji } from '../../lib/format'
import { coSocios, saldoNumerico, esPendienteConfirmacion, montoInfo, estadoBadgeStatus } from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import Modal from '../../components/crm/Modal'
import PagoModal from '../../components/crm/PagoModal'
import PagosGrid from '../../components/crm/PagosGrid'
import CurrencyInput from '../../components/crm/CurrencyInput'
import StatusBadge from '../../components/crm/StatusBadge'
import ConfirmDeleteModal from '../../components/crm/ConfirmDeleteModal'
import { Plus, Edit2, Trash2, Search, Wallet, ChevronDown, Mail, Phone, FileText, Sun, CircleDollarSign } from 'lucide-react'

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
  const { reservas, unidades, temporadaActiva, loading: resLoading, createReserva, updateReserva } = useReservas()
  const { pagos: todosPagos } = usePagos() // sin reservaId: historial completo, filtrado acá por cliente
  const [searchParams, setSearchParams] = useSearchParams()
  const { alert } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
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
  const [telefono, setTelefono] = useState('')
  const [cuit, setCuit] = useState('')
  const [mail, setMail] = useState('')
  const [notas, setNotas] = useState('')

  // Alta de reserva de temporada (Fase 1, sep 2026): vive del lado de
  // Clientes, no de Reservas, porque un "cliente de temporada" es un
  // registro en `reservas` con tipo_alquiler='temporada' vinculado a un
  // cliente_id — Reservas.jsx ahora es solo la cola de período/día y ese
  // tipo se sacó a propósito de su selector. Dos puntos de entrada
  // reutilizan los mismos campos: (1) checkbox opcional al crear un cliente
  // nuevo, (2) botón "Agregar Temporada" en la fila expandida de uno ya
  // existente (`temporadaTarget`).
  const [agregarTemporadaNueva, setAgregarTemporadaNueva] = useState(false)
  const [temporadaTarget, setTemporadaTarget] = useState(null) // cliente existente, o null
  const [tUnidadId, setTUnidadId] = useState('')
  const [tValorTotal, setTValorTotal] = useState(0)
  const [tNotas, setTNotas] = useState('')
  // Unidad bonificada (sep 2026): fuerza el precio a 0 y lo deshabilita — el
  // trigger fn_reserva_recalcula_saldo hace cumplir esto igual en la base.
  const [tBonificada, setTBonificada] = useState(false)
  const [savingTemporada, setSavingTemporada] = useState(false)

  const resetTemporadaForm = () => {
    setTUnidadId('')
    setTValorTotal(0)
    setTNotas('')
    setTBonificada(false)
  }

  const handleOpenCreate = () => {
    setEditingCliente(null)
    setNombre('')
    setTelefono('')
    setCuit('')
    setMail('')
    setNotas('')
    setAgregarTemporadaNueva(false)
    resetTemporadaForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (cliente) => {
    setEditingCliente(cliente)
    setNombre(cliente.nombre)
    setTelefono(cliente.telefono || '')
    setCuit(cliente.cuit || '')
    setMail(cliente.mail || '')
    setNotas(cliente.notas || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { nombre: nombre.toUpperCase(), telefono, cuit, mail, notas }
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

  // Alta de temporada para un cliente YA existente, desde la fila expandida.
  const handleSubmitTemporada = async (e) => {
    e.preventDefault()
    if (!temporadaTarget || !tUnidadId) return
    setSavingTemporada(true)
    try {
      await createReserva({
        cliente_id: temporadaTarget.id,
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
      setTemporadaTarget(null)
      resetTemporadaForm()
    } catch (err) {
      await alert('No se pudo crear la reserva de temporada.')
    } finally {
      setSavingTemporada(false)
    }
  }

  const [clienteAEliminar, setClienteAEliminar] = useState(null)

  const handleConfirmDeleteCliente = async () => {
    if (!clienteAEliminar) return
    try {
      await deleteCliente(clienteAEliminar.id)
      setClienteAEliminar(null)
    } catch (err) {
      await alert('No se pudo borrar el cliente.')
    }
  }

  // Deep-link desde la búsqueda global del TopBar: /app/clientes?id=<uuid>
  // abre directo la fila expandida de ese cliente (en vez de un modal) y la
  // centra en el viewport — el directorio está ordenado alfabéticamente con
  // cientos de clientes, así que la fila casi nunca está a la vista (bug
  // detectado en auditoría: buscar "gloria bianco" navegaba a Clientes pero
  // dejaba a Adriana Aguero arriba de todo, sin scrollear). El scroll va acá
  // adentro, no en un efecto separado atado a `expandedId`: si el cliente
  // buscado ya estaba expandido de una búsqueda anterior, `expandedId` no
  // cambia de valor y un efecto con esa dependencia nunca se dispararía la
  // segunda vez. setTimeout (no requestAnimationFrame: una pestaña sin foco
  // puede pausarlo indefinidamente) espera al próximo tick, ya con la fila
  // recién expandida pintada en el DOM.
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id || loading) return
    const cliente = clientes.find((c) => c.id === id)
    if (cliente) {
      setExpandedId(cliente.id)
      // Directorio sin virtualizar (234 filas): expandir una fila más abajo
      // en la lista dispara su propio contenido (reservas, PagosGrid con
      // fetch de pagos) que sigue creciendo unos ms después del expand —
      // un scrollIntoView smooth disparado antes de que asiente esa altura
      // final termina a mitad de camino. 150ms de margen + salto directo
      // (sin animación) evita esa carrera.
      setTimeout(() => {
        document.querySelector(`[data-cliente-id="${cliente.id}"]`)
          ?.scrollIntoView({ behavior: 'auto', block: 'center' })
      }, 150)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, clientes, loading])

  // Deep-link desde "Asignar cliente de temporada" en el modal de unidad del
  // Plano: /app/clientes?unidad=<uuid>&tipo=temporada — abre el alta de
  // cliente nuevo con la unidad ya precargada en el form de temporada. Solo
  // arma un cliente NUEVO (el alta de temporada para un cliente existente ya
  // tiene su propio flujo, el botón "Agregar Temporada" de la fila expandida).
  useEffect(() => {
    const unidad = searchParams.get('unidad')
    if (!unidad || searchParams.get('id') || loading) return
    handleOpenCreate()
    setAgregarTemporadaNueva(true)
    setTUnidadId(unidad)
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading])

  const debouncedSearch = useDebounced(searchTerm)
  const filteredClientes = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(term) ||
      (c.cuit && c.cuit.includes(debouncedSearch))
    )
  }, [clientes, debouncedSearch])

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
    for (const r of reservas) {
      if (r.estado === 'cancelada' || !r.cliente_id) continue
      const entry = (map[r.cliente_id] ||= { total: 0, sinVerificar: false })
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
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre o CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/50 rounded-xl outline-none text-white text-sm transition-all"
          />
        </div>
        <button
          onClick={handleOpenCreate}
          className="sm:ml-auto bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl shrink-0"
        >
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Directorio: filas-tarjeta expandibles, NO una tabla */}
      {filteredClientes.length === 0 ? (
        <div className="p-12 text-center text-sm tracking-wider text-gray-500 glass-card rounded-xl">
          No se encontraron clientes.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClientes.map((cliente) => {
            const reservasCliente = reservasPorCliente[cliente.id] || []
            const saldoInfo = saldoPorCliente[cliente.id] || { total: 0, sinVerificar: false }
            const isExpanded = expandedId === cliente.id
            const unidadesCliente = unidadesDeReservas([
              ...reservasCliente,
              ...(reservasComoCoSocioPorCliente[cliente.id] || []),
            ])
            const reservaBadge = reservaActivaDeTemporada(reservasCliente)
            const sinPrecio = precioSinDefinir(reservasCliente)
            // Reservas sobre las que tiene sentido ofrecer "Registrar pago"
            // desde acá — las bonificadas nunca admiten pagos (bloqueado a
            // nivel base), así que quedan afuera de las opciones del modal.
            const reservasPagables = reservasCliente.filter((r) => r.estado !== 'cancelada' && !r.bonificada)
            // Exception del saldo "Monto nulo" (Tarea 3.2): si la reserva que
            // manda el badge del header ya está pagada o bonificada, el saldo
            // agregado en $0 es real (saldado), no un monto sin verificar.
            const saldoHeaderSaldado = reservaBadge && (reservaBadge.estado_pago === 'pagado' || reservaBadge.bonificada)

            return (
              <div
                key={cliente.id}
                data-cliente-id={cliente.id}
                className={`glass-card rounded-xl overflow-hidden border transition-all ${isExpanded ? 'border-cyan-400/40' : 'border-white/10'}`}
              >
                {/* Toda la caja es clickeable para expandir/colapsar */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : cliente.id)}
                  className="w-full text-left px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-2 cursor-pointer hover:bg-white/5 transition-all"
                >
                  <ChevronDown
                    size={18}
                    className={`text-cyan-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  <div className="min-w-[160px]">
                    <p className="font-bold text-white uppercase">{cliente.nombre}</p>
                    <p className="text-gray-300 text-xs mt-0.5 flex items-center gap-1.5">
                      <Phone size={11} className="text-gray-600 shrink-0" />
                      {cliente.telefono || <span className="text-gray-500">Sin cargar</span>}
                    </p>
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
                  {reservaBadge && <StatusBadge status={estadoBadgeStatus(reservaBadge)} />}
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
                      formatMontoVisible(saldoInfo.total) && (
                        <span className="font-bold text-sm text-red-400">{formatMontoVisible(saldoInfo.total)}</span>
                      )
                    )}
                  </p>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPagoCliente(cliente)}
                      disabled={reservasPagables.length === 0}
                      className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-green-400 transition-all"
                      title="Registrar pago"
                    >
                      <Wallet size={16} />
                    </button>
                    <button onClick={() => handleOpenEdit(cliente)} className="p-2 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setClienteAEliminar(cliente)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all" title="Borrar">
                      <Trash2 size={16} />
                    </button>
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
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><FileText size={11} /> CUIT / DNI</p>
                        <p className="text-sm text-white mt-1">{cliente.cuit || <span className="text-gray-500">Sin cargar</span>}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cliente desde</p>
                        <p className="text-sm text-white mt-1">{formatDate(cliente.created_at)}</p>
                      </div>
                      {cliente.notas && (
                        <div className="col-span-2 md:col-span-4">
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Notas</p>
                          <p className="text-sm text-gray-300 mt-1">{cliente.notas}</p>
                        </div>
                      )}
                    </div>

                    {/* Reservas asociadas: históricas y actuales, cualquier tipo */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          Reservas ({reservasCliente.length})
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            resetTemporadaForm()
                            setTemporadaTarget(cliente)
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all"
                        >
                          <Sun size={13} /> Agregar Temporada
                        </button>
                      </div>
                      {reservasCliente.length === 0 ? (
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Sin reservas registradas.</p>
                      ) : (
                        <div className="space-y-2">
                          {reservasCliente.map((r) => {
                            const socios = coSocios(r)
                            const fechas =
                              r.tipo_alquiler === 'temporada'
                                ? r.temporada
                                : r.tipo_alquiler === 'dia'
                                  ? formatDate(r.fecha)
                                  : `${formatDate(r.fecha_inicio)} — ${formatDate(r.fecha_fin)}`
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
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                        Pagos por Reserva
                      </p>
                      {reservasCliente.length === 0 ? (
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Sin reservas — nada para cobrar todavía.</p>
                      ) : (
                        <div className="space-y-4">
                          {reservasCliente.map((r) => (
                            <PagosGrid
                              key={r.id}
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
                          ))}
                        </div>
                      )}
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
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nombre Completo</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`${inputClass} uppercase`}
              placeholder="Ej. JUAN PÉREZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputClass}
                placeholder="+54 9..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">CUIT / DNI</label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className={inputClass}
                placeholder="20-12345678-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className={`${inputClass} lowercase`}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Notas / Comentarios</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className={`${inputClass} resize-none font-normal normal-case`}
              placeholder="Comentarios adicionales..."
            />
          </div>

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
                      <select
                        required={agregarTemporadaNueva}
                        value={tUnidadId}
                        onChange={(e) => setTUnidadId(e.target.value)}
                        className={`${inputClass} uppercase`}
                      >
                        <option value="" disabled>Seleccionar...</option>
                        {unidades.map((u) => <option key={u.id} value={u.id}>{unidadEmoji(u.tipo)} {u.tipo} #{u.numero}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
                      <p className={`${inputClass} text-gray-300`}>{temporadaActiva?.nombre || '—'}</p>
                    </div>
                  </div>
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
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
                    <CurrencyInput
                      value={tBonificada ? 0 : tValorTotal}
                      onChange={setTValorTotal}
                      disabled={tBonificada}
                      className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                    {tBonificada && (
                      <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">
                        Carpa bonificada: sin cargo, no registra pagos.
                      </p>
                    )}
                  </div>
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

      {/* Alta de temporada para un cliente YA existente (botón "Agregar
          Temporada" en la fila expandida) — mismos campos que arriba. */}
      <Modal
        isOpen={!!temporadaTarget}
        onClose={() => setTemporadaTarget(null)}
        title={`Nueva Temporada — ${temporadaTarget?.nombre || ''}`}
      >
        <form onSubmit={handleSubmitTemporada} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad</label>
              <select
                required
                value={tUnidadId}
                onChange={(e) => setTUnidadId(e.target.value)}
                className={`${inputClass} uppercase`}
              >
                <option value="" disabled>Seleccionar...</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{unidadEmoji(u.tipo)} {u.tipo} #{u.numero}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
              <p className={`${inputClass} text-gray-300`}>{temporadaActiva?.nombre || '—'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
            <label htmlFor="temporada-existente-bonificada" className="text-[10px] font-bold text-gray-300 uppercase tracking-widest cursor-pointer">
              Unidad bonificada
            </label>
            <input
              id="temporada-existente-bonificada"
              type="checkbox"
              checked={tBonificada}
              onChange={(e) => setTBonificada(e.target.checked)}
              className="accent-cyan-400 w-4 h-4 cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
            <CurrencyInput
              value={tBonificada ? 0 : tValorTotal}
              onChange={setTValorTotal}
              required={!tBonificada}
              disabled={tBonificada}
              className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            {tBonificada && (
              <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">
                Carpa bonificada: sin cargo, no registra pagos.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Notas de la reserva</label>
            <textarea
              rows={3}
              value={tNotas}
              onChange={(e) => setTNotas(e.target.value)}
              className={`${inputClass} resize-none font-normal normal-case`}
            />
          </div>
          <button
            type="submit"
            disabled={savingTemporada}
            className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {savingTemporada ? 'Guardando...' : 'Crear Reserva de Temporada'}
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
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
            <CurrencyInput value={confirmarValorTotal} onChange={setConfirmarValorTotal} required className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={savingConfirmacion}
            className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
          >
            {savingConfirmacion ? 'Guardando...' : 'Confirmar'}
          </button>
        </form>
      </Modal>

      {/* Pago Modal (Fase 2) — mismo componente/hook que usa Reservas */}
      <PagoModal
        isOpen={!!pagoCliente}
        onClose={() => setPagoCliente(null)}
        reservasOptions={
          pagoCliente
            ? (reservasPorCliente[pagoCliente.id] || [])
                .filter((r) => r.estado !== 'cancelada' && !r.bonificada)
                .map((r) => ({ ...r, clientes: pagoCliente }))
            : []
        }
      />

      {/* Pago Modal disparado desde una celda de PagosGrid: reserva ya fija,
          y si la celda tenía un pago cargado entra en modo consulta. */}
      <PagoModal
        isOpen={!!pagoCelda}
        onClose={() => setPagoCelda(null)}
        reservasOptions={pagoCelda ? [pagoCelda.reserva] : []}
        initialReservaId={pagoCelda?.reserva?.id || ''}
        pagoExistente={pagoCelda?.pago || null}
      />

      <ConfirmDeleteModal
        isOpen={!!clienteAEliminar}
        onClose={() => setClienteAEliminar(null)}
        onConfirm={handleConfirmDeleteCliente}
        tipo="cliente"
        identificador={clienteAEliminar?.nombre || ''}
        detalle="Sus reservas no se borran: quedan sin cliente asociado."
      />
    </div>
  )
}

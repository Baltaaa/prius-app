import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClientes } from '../../hooks/useClientes'
import { useReservas } from '../../hooks/useReservas'
import { usePagos } from '../../hooks/usePagos'
import { useDebounced } from '../../hooks/useDebounced'
import { formatCurrency, formatDate } from '../../lib/format'
import Modal from '../../components/crm/Modal'
import PagoModal from '../../components/crm/PagoModal'
import PagosGrid from '../../components/crm/PagosGrid'
import CurrencyInput from '../../components/crm/CurrencyInput'
import StatusBadge from '../../components/crm/StatusBadge'
import { Plus, Edit2, Trash2, Search, Wallet, ChevronDown, Users, Mail, Phone, FileText, Sun } from 'lucide-react'

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

export default function Clientes() {
  const { clientes, loading, createCliente, updateCliente, deleteCliente } = useClientes()
  const { reservas, unidades, loading: resLoading, createReserva } = useReservas()
  const { pagos: todosPagos } = usePagos() // sin reservaId: historial completo, filtrado acá por cliente
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [pagoCliente, setPagoCliente] = useState(null)
  const [pagoCelda, setPagoCelda] = useState(null) // { reserva, pago } | null — click en PagosGrid
  const [expandedId, setExpandedId] = useState(null) // un solo cliente expandido a la vez

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
  const [tTemporadaLabel, setTTemporadaLabel] = useState('2026/2027')
  const [tValorTotal, setTValorTotal] = useState(0)
  const [tNotas, setTNotas] = useState('')
  const [savingTemporada, setSavingTemporada] = useState(false)

  const resetTemporadaForm = () => {
    setTUnidadId('')
    setTTemporadaLabel('2026/2027')
    setTValorTotal(0)
    setTNotas('')
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
            temporada: tTemporadaLabel,
            tipo_alquiler: 'temporada',
            estado: 'activa',
            origen: 'manual',
            valor_total: Number(tValorTotal || 0),
            notas: tNotas,
          })
        }
      }
      setIsModalOpen(false)
    } catch (err) {
      alert('Error guardando cliente.')
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
        temporada: tTemporadaLabel,
        tipo_alquiler: 'temporada',
        estado: 'activa',
        origen: 'manual',
        valor_total: Number(tValorTotal || 0),
        notas: tNotas,
      })
      setTemporadaTarget(null)
      resetTemporadaForm()
    } catch (err) {
      alert('No se pudo crear la reserva de temporada.')
    } finally {
      setSavingTemporada(false)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('¿Está seguro de eliminar este cliente?')) {
      try {
        await deleteCliente(id)
      } catch (err) {
        alert('No se pudo borrar el cliente.')
      }
    }
  }

  // Deep-link desde la búsqueda global del TopBar: /app/clientes?id=<uuid>
  // abre directo la fila expandida de ese cliente (en vez de un modal).
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id || loading) return
    const cliente = clientes.find((c) => c.id === id)
    if (cliente) setExpandedId(cliente.id)
    setSearchParams({}, { replace: true })
  }, [searchParams, clientes, loading])

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

  const saldoPorCliente = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      if (r.estado === 'cancelada' || !r.cliente_id) continue
      map[r.cliente_id] = (map[r.cliente_id] || 0) + Number(r.saldo || 0)
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
            <Users size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Directorio de Clientes</h1>
            <p className="text-gray-400 text-sm mt-2">Historial completo: temporada actual, temporadas y alquileres pasados.</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl"
        >
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Toolbar */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o CUIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-400/50 rounded-xl outline-none text-white text-sm transition-all"
        />
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
            const saldoTotal = saldoPorCliente[cliente.id] || 0
            const isExpanded = expandedId === cliente.id

            return (
              <div
                key={cliente.id}
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
                    <p className="text-[11px] text-gray-500 uppercase mt-0.5">CUIT: {cliente.cuit || '-'}</p>
                  </div>
                  <p className="text-gray-300 text-sm min-w-[110px]">{cliente.telefono || '-'}</p>
                  <p className="text-gray-400 text-sm lowercase min-w-[160px] hidden sm:block">{cliente.mail || '-'}</p>
                  <p className="text-[11px] text-gray-500 uppercase font-bold tracking-widest hidden md:block">
                    {reservasCliente.length} reserva{reservasCliente.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex-1" />
                  <p className={`font-bold text-sm ${saldoTotal > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(saldoTotal)}
                  </p>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPagoCliente(cliente)}
                      disabled={reservasCliente.filter((r) => r.estado !== 'cancelada').length === 0}
                      className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-green-400 transition-all"
                      title="Registrar pago"
                    >
                      <Wallet size={16} />
                    </button>
                    <button onClick={() => handleOpenEdit(cliente)} className="p-2 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(cliente.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all" title="Borrar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Sección expandida — inline, sin modal ni ruta nueva */}
                {isExpanded && (
                  <div className="border-t border-cyan-400/20 bg-black/20 px-6 py-6 space-y-6">
                    {/* Datos completos */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><Phone size={11} /> Teléfono</p>
                        <p className="text-sm text-white mt-1">{cliente.telefono || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><Mail size={11} /> Email</p>
                        <p className="text-sm text-white mt-1 lowercase">{cliente.mail || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><FileText size={11} /> CUIT / DNI</p>
                        <p className="text-sm text-white mt-1">{cliente.cuit || '-'}</p>
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
                          {reservasCliente.map((r) => (
                            <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs">
                              <span className="font-bold text-cyan-400 uppercase tracking-widest">{TIPO_LABEL[r.tipo_alquiler] || r.tipo_alquiler}</span>
                              <span className="text-gray-300">{r.unidades?.tipo} #{r.unidades?.numero}</span>
                              <span className="text-gray-500">{r.temporada}</span>
                              {r.estado === 'cancelada' && <span className="text-red-400 font-bold uppercase">Cancelada</span>}
                              <div className="flex-1" />
                              <span className="text-white font-bold">{formatCurrency(r.valor_total)}</span>
                              <span className={Number(r.saldo) > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                                {formatCurrency(r.saldo)}
                              </span>
                              <StatusBadge status={r.estado_pago} />
                            </div>
                          ))}
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
                        {unidades.map((u) => <option key={u.id} value={u.id}>{u.tipo} #{u.numero}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
                      <input
                        type="text"
                        value={tTemporadaLabel}
                        onChange={(e) => setTTemporadaLabel(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
                    <CurrencyInput value={tValorTotal} onChange={setTValorTotal} className={inputClass} />
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
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.tipo} #{u.numero}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
              <input
                type="text"
                value={tTemporadaLabel}
                onChange={(e) => setTTemporadaLabel(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
            <CurrencyInput value={tValorTotal} onChange={setTValorTotal} required className={inputClass} />
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

      {/* Pago Modal (Fase 2) — mismo componente/hook que usa Reservas */}
      <PagoModal
        isOpen={!!pagoCliente}
        onClose={() => setPagoCliente(null)}
        reservasOptions={
          pagoCliente
            ? (reservasPorCliente[pagoCliente.id] || [])
                .filter((r) => r.estado !== 'cancelada')
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
    </div>
  )
}

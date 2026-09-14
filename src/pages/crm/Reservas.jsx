import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatCurrency, formatDate } from '../../lib/format'
import { useDebounced } from '../../hooks/useDebounced'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import PagoModal from '../../components/crm/PagoModal'
import CurrencyInput from '../../components/crm/CurrencyInput'
import StatusBadge from '../../components/crm/StatusBadge'
import { Plus, Edit2, Trash2, Search, Filter, Check, Wallet, CalendarClock, Globe, MonitorSmartphone } from 'lucide-react'

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
  const { reservas, unidades, loading: resLoading, createReserva, updateReserva, deleteReserva } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()
  const [searchParams, setSearchParams] = useSearchParams()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [pagoReserva, setPagoReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  // Form state
  const [clienteId, setClienteId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [temporada, setTemporada] = useState('2025-2026')
  const [tipoAlquiler, setTipoAlquiler] = useState('periodo')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [fecha, setFecha] = useState('')
  const [valorTotal, setValorTotal] = useState(0)
  const [notas, setNotas] = useState('')

  const resetForm = () => {
    setClienteId('')
    setUnidadId('')
    setTemporada('2025-2026')
    setTipoAlquiler('periodo')
    setFechaInicio('')
    setFechaFin('')
    setFecha('')
    setValorTotal(0)
    setNotas('')
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
    setTemporada(res.temporada || '2025-2026')
    setTipoAlquiler(res.tipo_alquiler || 'periodo')
    setFechaInicio(res.fecha_inicio || '')
    setFechaFin(res.fecha_fin || '')
    setFecha(res.fecha || '')
    setValorTotal(res.valor_total ?? 0)
    setNotas(res.notas || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      cliente_id: clienteId,
      unidad_id: unidadId,
      temporada,
      tipo_alquiler: tipoAlquiler,
      estado: 'activa',
      // Reservas solo da de alta período/día — todavía manual (sin origen web).
      origen: 'manual',
      fecha_inicio: tipoAlquiler === 'periodo' ? fechaInicio || null : null,
      fecha_fin: tipoAlquiler === 'periodo' ? fechaFin || null : null,
      fecha: tipoAlquiler === 'dia' ? fecha || null : null,
      valor_total: Number(valorTotal || 0),
      // saldo / estado_pago ya no se cargan a mano: los recalcula el trigger
      // fn_reserva_recalcula_saldo (a partir de valor_total y la suma de
      // `pagos`) — ver PagoModal / usePagos.
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
      alert('Error guardando la reserva.')
    }
  }

  const handleDelete = async (res) => {
    if (confirm(`¿Eliminar la reserva de ${res.clientes?.nombre || 'este cliente'}?`)) {
      try {
        await deleteReserva(res.id, res.unidad_id)
      } catch (err) {
        alert('No se pudo eliminar la reserva.')
      }
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

  const debouncedSearch = useDebounced(searchTerm)

  // Cola operativa: solo período/día. La temporada completa vive en Clientes
  // (directorio maestro), no acá — ver CLAUDE.md.
  const reservasOperativas = useMemo(
    () => reservas.filter((r) => TIPOS_OPERATIVOS.includes(r.tipo_alquiler)),
    [reservas],
  )

  const filteredReservas = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return reservasOperativas
      .filter((r) => {
        const matchesSearch =
          !term ||
          r.clientes?.nombre?.toLowerCase().includes(term) ||
          String(r.unidades?.numero ?? '').includes(term)
        const matchesEstado = filtroEstado === 'todos' || r.estado_pago === filtroEstado
        const matchesTipo = filtroTipo === 'todos' || r.tipo_alquiler === filtroTipo
        const llegada = fechaLlegada(r)
        const matchesDesde = !desde || (llegada && llegada >= desde)
        const matchesHasta = !hasta || (llegada && llegada <= hasta)
        return matchesSearch && matchesEstado && matchesTipo && matchesDesde && matchesHasta
      })
      // Llegadas más recientes primero.
      .sort((a, b) => (fechaLlegada(b) || '').localeCompare(fechaLlegada(a) || ''))
  }, [reservasOperativas, debouncedSearch, filtroEstado, filtroTipo, desde, hasta])

  const filtrosActivos = filtroEstado !== 'todos' || filtroTipo !== 'todos' || desde || hasta

  const headers = ['Llegada', 'Cliente', 'Unidad', 'Monto Total', 'Saldo', 'Estado', 'Origen', 'Acciones']

  if (resLoading || cliLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Cargando Reservas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FDE047]/10 border border-[#FDE047]/20 flex items-center justify-center shrink-0">
            <CalendarClock size={20} className="text-[#FDE047]" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Cola de Reservas</h1>
            <p className="text-gray-400 text-sm mt-2">Alquileres por período y día, ordenados por llegada. La temporada completa vive en Clientes.</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl"
        >
          <Plus size={18} /> Nueva Reserva
        </button>
      </div>

      {/* Toolbar / filtros — feed cronológico con filtros siempre visibles */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[240px] relative">
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
      </div>

      {/* Table Section */}
      <DataTable
        headers={headers}
        data={filteredReservas}
        emptyMessage="No hay reservas de período/día con esos filtros."
        renderRow={(res) => (
          <tr key={res.id} className="hover:bg-white/5 transition-all group">
            <td className="px-6 py-5 text-gray-300 font-medium whitespace-nowrap">{formatDate(fechaLlegada(res))}</td>
            <td className="px-6 py-5 font-bold text-white uppercase">{res.clientes?.nombre || 'S/N'}</td>
            <td className="px-6 py-5 font-medium text-gray-300 uppercase">{res.unidades?.tipo} #{res.unidades?.numero}</td>
            <td className="px-6 py-5 font-bold text-white">{formatCurrency(res.valor_total)}</td>
            <td className={`px-6 py-5 font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(res.saldo)}
            </td>
            <td className="px-6 py-5">
              <StatusBadge status={res.estado_pago} />
            </td>
            <td className="px-6 py-5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {res.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                {res.origen === 'web' ? 'Web' : 'Manual'}
              </span>
            </td>
            <td className="px-6 py-5">
              <div className="flex gap-2">
                <button
                  onClick={() => setPagoReserva(res)}
                  disabled={Number(res.saldo) <= 0}
                  className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-green-400 transition-all"
                  title={Number(res.saldo) > 0 ? 'Registrar pago' : 'Sin saldo pendiente'}
                >
                  <Wallet size={16} />
                </button>
                <button onClick={() => handleOpenEdit(res)} className="p-2 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(res)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(res) => (
          <>
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formatDate(fechaLlegada(res))}</p>
                <h3 className="font-bold uppercase text-sm text-white truncate">{res.clientes?.nombre || 'S/N'}</h3>
                <p className="text-[11px] text-gray-500 uppercase mt-0.5">
                  {res.unidades?.tipo} #{res.unidades?.numero} &bull; {res.tipo_alquiler}
                </p>
              </div>
              <StatusBadge status={res.estado_pago} />
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-3">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Saldo</p>
                <p className={`text-sm font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(res.saldo)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagoReserva(res)}
                  disabled={Number(res.saldo) <= 0}
                  className="p-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-green-400 transition-all"
                >
                  <Wallet size={16} />
                </button>
                <button onClick={() => handleOpenEdit(res)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(res)} className="p-2.5 bg-white/5 hover:bg-red-500/10 rounded-lg text-red-400 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      />

      {/* Modal Form */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Seleccionar Cliente</label>
            <select
              required
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold"
            >
              <option value="" disabled>Seleccionar...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad</label>
              <select
                required
                value={unidadId}
                onChange={(e) => setUnidadId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold"
              >
                <option value="" disabled>Seleccionar...</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.tipo} #{u.numero}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
              <input
                type="text"
                value={temporada}
                onChange={(e) => setTemporada(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold"
              />
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
                  onClick={() => setTipoAlquiler(t.key)}
                  className={`py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha Inicio</label>
                <input
                  type="date"
                  required
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold [color-scheme:dark]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha Fin</label>
                <input
                  type="date"
                  required
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold [color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {tipoAlquiler === 'dia' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold [color-scheme:dark]"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
            <CurrencyInput
              value={valorTotal}
              onChange={setValorTotal}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold"
            />
          </div>

          {/* Saldo y estado de pago ya no se cargan a mano: los recalcula el
              trigger fn_reserva_recalcula_saldo / fn_pago_actualiza_saldo a
              partir de valor_total y los pagos registrados en `pagos`. */}
          {editingReserva && (
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saldo Pendiente</p>
                <p className={`text-lg font-bold ${Number(editingReserva.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(editingReserva.saldo)}
                </p>
              </div>
              <StatusBadge status={editingReserva.estado_pago} />
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
    </div>
  )
}

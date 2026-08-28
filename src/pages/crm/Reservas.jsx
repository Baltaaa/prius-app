import React, { useState, useMemo } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatCurrency } from '../../lib/format'
import { useDebounced } from '../../hooks/useDebounced'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import StatusBadge from '../../components/crm/StatusBadge'
import { Plus, Edit2, Trash2, Search, Filter, Check } from 'lucide-react'

const FILTROS_ESTADO = [
  { value: 'todos', label: 'Todas' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pendiente', label: 'Pendiente' },
]

export default function Reservas() {
  const { reservas, unidades, loading: resLoading, createReserva, updateReserva, deleteReserva } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [showFiltros, setShowFiltros] = useState(false)

  // Form state
  const [clienteId, setClienteId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [temporada, setTemporada] = useState('2025-2026')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [saldo, setSaldo] = useState('')
  const [estadoPago, setEstadoPago] = useState('pendiente')
  const [notas, setNotas] = useState('')

  const resetForm = () => {
    setClienteId('')
    setUnidadId('')
    setTemporada('2025-2026')
    setFechaInicio('')
    setFechaFin('')
    setValorTotal('')
    setSaldo('')
    setEstadoPago('pendiente')
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
    setFechaInicio(res.fecha_inicio || '')
    setFechaFin(res.fecha_fin || '')
    setValorTotal(res.valor_total ?? '')
    setSaldo(res.saldo ?? '')
    setEstadoPago(res.estado_pago || 'pendiente')
    setNotas(res.notas || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      cliente_id: clienteId,
      unidad_id: unidadId,
      temporada,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      valor_total: Number(valorTotal || 0),
      saldo: Number(saldo || 0),
      estado_pago: estadoPago,
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

  const debouncedSearch = useDebounced(searchTerm)

  const filteredReservas = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return reservas.filter((r) => {
      const matchesSearch =
        !term ||
        r.clientes?.nombre?.toLowerCase().includes(term) ||
        String(r.unidades?.numero ?? '').includes(term)
      const matchesEstado = filtroEstado === 'todos' || r.estado_pago === filtroEstado
      return matchesSearch && matchesEstado
    })
  }, [reservas, debouncedSearch, filtroEstado])

  const headers = ['Cliente', 'Unidad', 'Temporada', 'Monto Total', 'Saldo', 'Estado Pago', 'Acciones']

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
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Gestión de Reservas</h1>
          <p className="text-gray-400 text-sm mt-2">Control centralizado de alquileres y pagos.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl"
        >
          <Plus size={18} /> Nueva Reserva
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por cliente o unidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-[#FDE047]/50 rounded-xl outline-none text-white text-sm transition-all"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`glass-card px-4 py-3 rounded-xl flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest ${filtroEstado !== 'todos' ? 'text-[#FDE047]' : 'text-gray-400 hover:text-white'}`}
          >
            <Filter size={16} /> {filtroEstado === 'todos' ? 'Filtros Avanzados' : `Estado: ${filtroEstado}`}
          </button>

          {showFiltros && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFiltros(false)} />
              <div className="absolute right-0 mt-2 w-48 glass-card rounded-xl overflow-hidden z-50 p-1">
                {FILTROS_ESTADO.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => { setFiltroEstado(f.value); setShowFiltros(false) }}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-white/10 flex items-center justify-between rounded-lg"
                  >
                    {f.label}
                    {filtroEstado === f.value && <Check size={14} className="text-[#FDE047]" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table Section */}
      <DataTable
        headers={headers}
        data={filteredReservas}
        emptyMessage="No se encontraron reservas con esos filtros."
        renderRow={(res) => (
          <tr key={res.id} className="hover:bg-white/5 transition-all group">
            <td className="px-6 py-5 font-bold text-white uppercase">{res.clientes?.nombre || 'S/N'}</td>
            <td className="px-6 py-5 font-medium text-gray-300 uppercase">{res.unidades?.tipo} #{res.unidades?.numero}</td>
            <td className="px-6 py-5 text-gray-400 font-medium">{res.temporada}</td>
            <td className="px-6 py-5 font-bold text-white">{formatCurrency(res.valor_total)}</td>
            <td className={`px-6 py-5 font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(res.saldo)}
            </td>
            <td className="px-6 py-5">
              <StatusBadge status={res.estado_pago} />
            </td>
            <td className="px-6 py-5">
              <div className="flex gap-2">
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
                <h3 className="font-bold uppercase text-sm text-white truncate">{res.clientes?.nombre || 'S/N'}</h3>
                <p className="text-[11px] text-gray-500 uppercase mt-0.5">
                  {res.unidades?.tipo} #{res.unidades?.numero} &bull; {res.temporada}
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReserva ? 'Editar Reserva' : 'Nueva Contratación'}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
              <input
                type="number"
                required
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saldo Pendiente</label>
              <input
                type="number"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estado de Pago</label>
            <select
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold"
            >
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

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
    </div>
  )
}

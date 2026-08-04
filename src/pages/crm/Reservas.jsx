import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import StatusBadge from '../../components/crm/StatusBadge'
import { Plus, Edit2, Trash2, Search, Filter } from 'lucide-react'

export default function Reservas() {
  const { reservas, unidades, loading: resLoading, createReserva, updateReserva, deleteReserva } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const handleOpenCreate = () => {
    setEditingReserva(null)
    setIsModalOpen(true)
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

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
        <button className="glass-card px-4 py-3 rounded-xl flex items-center gap-2 text-gray-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
          <Filter size={16} /> Filtros Avanzados
        </button>
      </div>

      {/* Table Section */}
      <DataTable
        headers={headers}
        data={reservas}
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
                <button onClick={() => setEditingReserva(res)} className="p-2 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all">
                  <Edit2 size={16} />
                </button>
                <button className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Modal Form Estilizado */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nueva Contratación">
        <form className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Seleccionar Cliente</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold">
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold">
                {unidades.map(u => <option key={u.id} value={u.id}>{u.tipo} #{u.numero}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</label>
              <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold" />
            </div>
          </div>

          <button className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl">
            Confirmar Operación
          </button>
        </form>
      </Modal>
    </div>
  )
}
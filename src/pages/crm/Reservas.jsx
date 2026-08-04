import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import StatusBadge from '../../components/crm/StatusBadge'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function Reservas() {
  const { reservas, unidades, loading: resLoading, createReserva, updateReserva, deleteReserva } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()

  // Filtros
  const [temporadaFilter, setTemporadaFilter] = useState('2025-2026')
  const [estadoPagoFilter, setEstadoPagoFilter] = useState('all')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReserva, setEditingReserva] = useState(null)

  // Form states
  const [clienteId, setClienteId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [temporada, setTemporada] = useState('2025-2026')
  const [valorTotal, setValorTotal] = useState(0)
  const [saldo, setSaldo] = useState(0)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [estadoPago, setEstadoPago] = useState('pendiente')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [notas, setNotas] = useState('')

  const handleOpenCreate = () => {
    setEditingReserva(null)
    setClienteId(clientes[0]?.id || '')
    setUnidadId(unidades.filter(u => u.estado === 'libre')[0]?.id || '')
    setTemporada('2025-2026')
    setValorTotal(0)
    setSaldo(0)
    setFechaInicio('')
    setFechaFin('')
    setEstadoPago('pendiente')
    setNumeroFactura('')
    setNotas('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (res) => {
    setEditingReserva(res)
    setClienteId(res.cliente_id || '')
    setUnidadId(res.unidad_id || '')
    setTemporada(res.temporada)
    setValorTotal(res.valor_total)
    setSaldo(res.saldo)
    setFechaInicio(res.fecha_inicio || '')
    setFechaFin(res.fecha_fin || '')
    setEstadoPago(res.estado_pago)
    setNumeroFactura(res.numero_factura || '')
    setNotas(res.notas || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      cliente_id: clienteId || null,
      unidad_id: unidadId || null,
      temporada,
      valor_total: Number(valorTotal),
      saldo: Number(saldo),
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      estado_pago: estadoPago,
      numero_factura: numeroFactura,
      notas
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

  const handleDelete = async (id, unId) => {
    if (confirm('¿Está seguro de eliminar esta reserva? La unidad volverá a estar disponible.')) {
      try {
        await deleteReserva(id, unId)
      } catch (err) {
        alert('Error eliminando la reserva')
      }
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  const filteredReservas = reservas.filter(res => {
    const matchTemp = temporadaFilter === 'all' || res.temporada === temporadaFilter
    const matchPago = estadoPagoFilter === 'all' || res.estado_pago === estadoPagoFilter
    return matchTemp && matchPago
  })

  const headers = ['Cliente', 'Unidad', 'Temporada', 'Valor Total', 'Saldo Pendiente', 'Estado Pago', 'Factura', 'Fechas', 'Acciones']

  if (resLoading || cliLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-white/40">Cargando Reservas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Gestión de Reservas</h1>
          <p className="text-xs text-white/50 font-normal">Control total de ocupación y contrataciones.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#F2CA50]/10"
        >
          <Plus size={16} />
          Nueva Reserva
        </button>
      </div>

      {/* Filter panel */}
      <div className="flex flex-wrap gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-white/50 uppercase">Filtrar por Temporada</label>
          <select
            value={temporadaFilter}
            onChange={(e) => setTemporadaFilter(e.target.value)}
            className="block w-40 px-3 py-1.5 bg-[#181818] border border-white/10 text-xs font-semibold text-white rounded-xl focus:border-[#F2CA50] outline-none"
          >
            <option value="all">TODAS</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2024-2025">2024-2025</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-white/50 uppercase">Filtrar Estado de Pago</label>
          <select
            value={estadoPagoFilter}
            onChange={(e) => setEstadoPagoFilter(e.target.value)}
            className="block w-40 px-3 py-1.5 bg-[#181818] border border-white/10 text-xs font-semibold text-white rounded-xl focus:border-[#F2CA50] outline-none"
          >
            <option value="all">TODOS</option>
            <option value="pendiente">PENDIENTES</option>
            <option value="parcial">PARCIALES</option>
            <option value="pagado">PAGADOS</option>
          </select>
        </div>
      </div>

      {/* Data display */}
      <DataTable
        headers={headers}
        data={filteredReservas}
        emptyMessage="No se encontraron reservas con los filtros activos."
        renderRow={(res) => (
          <tr key={res.id} className="hover:bg-white/5 transition-colors">
            <td className="p-4 font-bold uppercase text-white">{res.clientes?.nombre || 'S/N'}</td>
            <td className="p-4 uppercase font-semibold text-white/80">
              {res.unidades?.tipo} #{res.unidades?.numero}
            </td>
            <td className="p-4 font-medium text-white/70">{res.temporada}</td>
            <td className="p-4 font-bold text-white">{formatCurrency(res.valor_total)}</td>
            <td className={`p-4 font-bold ${Number(res.saldo) > 0 ? 'text-rose-400' : 'text-white/90'}`}>
              {formatCurrency(res.saldo)}
            </td>
            <td className="p-4">
              <StatusBadge status={res.estado_pago} />
            </td>
            <td className="p-4 uppercase text-white/50">{res.numero_factura || '-'}</td>
            <td className="p-4 text-xs text-white/50">
              {res.fecha_inicio ? `${res.fecha_inicio} al ${res.fecha_fin}` : 'TEMPORADA COMPLETA'}
            </td>
            <td className="p-4 flex gap-2">
              <button onClick={() => handleOpenEdit(res)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white" title="Editar">
                <Edit2 size={15} />
              </button>
              <button onClick={() => handleDelete(res.id, res.unidad_id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-400" title="Borrar">
                <Trash2 size={15} />
              </button>
            </td>
          </tr>
        )}
        renderMobileCard={(res) => (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold uppercase text-xs text-white">{res.clientes?.nombre || 'S/N'}</h3>
                <p className="text-[11px] text-white/50 uppercase">
                  {res.unidades?.tipo} #{res.unidades?.numero} ({res.temporada})
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(res)} className="text-white/80 hover:text-white p-1">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(res.id, res.unidad_id)} className="text-rose-400 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="text-xs space-y-1 border-t border-white/10 pt-2 text-white/70">
              <div className="flex justify-between">
                <span>Total:</span>
                <strong className="text-white">{formatCurrency(res.valor_total)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Saldo:</span>
                <strong className={Number(res.saldo) > 0 ? 'text-rose-400' : 'text-white'}>{formatCurrency(res.saldo)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Estado:</span>
                <StatusBadge status={res.estado_pago} />
              </div>
              <p><strong>Fechas:</strong> {res.fecha_inicio ? `${res.fecha_inicio} al ${res.fecha_fin}` : 'TEMPORADA'}</p>
            </div>
          </>
        )}
      />

      {/* Booking Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70">Seleccionar Cliente *</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs uppercase focus:border-[#F2CA50] outline-none rounded-xl font-semibold [&>option]:bg-[#181818]"
              required
            >
              <option value="">-- SELECCIONAR CLIENTE --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Unidad Playa *</label>
              <select
                value={unidadId}
                onChange={(e) => setUnidadId(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs uppercase focus:border-[#F2CA50] outline-none rounded-xl font-semibold [&>option]:bg-[#181818]"
                required
              >
                <option value="">-- SELECCIONAR UNIDAD --</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.tipo.toUpperCase()} #{u.numero} ({u.estado.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Temporada *</label>
              <input
                type="text"
                required
                value={temporada}
                onChange={(e) => setTemporada(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Valor Total ($) *</label>
              <input
                type="number"
                required
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Saldo Pendiente ($)</label>
              <input
                type="number"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Fecha Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Fecha Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Estado de Pago</label>
              <select
                value={estadoPago}
                onChange={(e) => setEstadoPago(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs uppercase focus:border-[#F2CA50] outline-none rounded-xl font-semibold [&>option]:bg-[#181818]"
              >
                <option value="pendiente">PENDIENTE</option>
                <option value="parcial">PARCIAL</option>
                <option value="pagado">PAGADO</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Nro Factura / Recibo</label>
              <input
                type="text"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl"
                placeholder="A-0001-12345678"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70">Notas Adicionales</label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl resize-none"
              placeholder="Notas..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-full transition-colors"
          >
            {editingReserva ? 'Guardar Cambios' : 'Confirmar Reserva'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
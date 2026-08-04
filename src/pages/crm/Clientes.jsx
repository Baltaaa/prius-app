import React, { useState } from 'react'
import { useClientes } from '../../hooks/useClientes'
import DataTable from '../../components/crm/DataTable'
import Modal from '../../components/crm/Modal'
import { Plus, Edit2, Trash2, Search } from 'lucide-react'

export default function Clientes() {
  const { clientes, loading, createCliente, updateCliente, deleteCliente } = useClientes()
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)

  // Form states
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cuit, setCuit] = useState('')
  const [mail, setMail] = useState('')
  const [notas, setNotas] = useState('')

  const handleOpenCreate = () => {
    setEditingCliente(null)
    setNombre('')
    setTelefono('')
    setCuit('')
    setMail('')
    setNotas('')
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
        await createCliente(payload)
      }
      setIsModalOpen(false)
    } catch (err) {
      alert('Error guardando cliente.')
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

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cuit && c.cuit.includes(searchTerm))
  )

  const headers = ['Nombre', 'CUIT / DNI', 'Teléfono', 'Email', 'Notas', 'Acciones']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-white/40">Cargando Clientes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Directorio de Clientes</h1>
          <p className="text-xs text-white/50 font-normal">Base de datos de clientes históricos del balneario.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#F2CA50]/10"
        >
          <Plus size={16} />
          Nuevo Cliente
        </button>
      </div>

      {/* Filter and search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o CUIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] outline-none text-xs text-white placeholder:text-white/35 rounded-xl backdrop-blur-md"
        />
      </div>

      {/* Main Table */}
      <DataTable
        headers={headers}
        data={filteredClientes}
        emptyMessage="No se encontraron clientes."
        renderRow={(cliente) => (
          <tr key={cliente.id} className="hover:bg-white/5 transition-colors">
            <td className="p-4 font-bold uppercase text-white">{cliente.nombre}</td>
            <td className="p-4 font-medium text-white/70">{cliente.cuit || '-'}</td>
            <td className="p-4 text-white/80">{cliente.telefono || '-'}</td>
            <td className="p-4 lowercase text-white/60">{cliente.mail || '-'}</td>
            <td className="p-4 max-w-[200px] truncate text-white/50">{cliente.notas || '-'}</td>
            <td className="p-4 flex gap-2">
              <button onClick={() => handleOpenEdit(cliente)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white" title="Editar">
                <Edit2 size={15} />
              </button>
              <button onClick={() => handleDelete(cliente.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-400" title="Borrar">
                <Trash2 size={15} />
              </button>
            </td>
          </tr>
        )}
        renderMobileCard={(cliente) => (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold uppercase text-xs text-white">{cliente.nombre}</h3>
                <p className="text-[11px] text-white/50">CUIT: {cliente.cuit || '-'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(cliente)} className="p-1 text-white/80 hover:text-white">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(cliente.id)} className="p-1 text-rose-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="text-xs space-y-1 border-t border-white/10 pt-2 text-white/70">
              <p><strong>Tel:</strong> {cliente.telefono || '-'}</p>
              <p><strong>Mail:</strong> {cliente.mail || '-'}</p>
            </div>
          </>
        )}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70">Nombre Completo *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] outline-none text-xs text-white uppercase rounded-xl font-semibold"
              placeholder="Ej. JUAN PÉREZ"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] outline-none text-xs text-white rounded-xl"
                placeholder="+54 9..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">CUIT / DNI</label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] outline-none text-xs text-white rounded-xl"
                placeholder="20-12345678-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70">Email</label>
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] outline-none text-xs text-white lowercase rounded-xl"
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70">Notas / Comentarios</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] outline-none text-xs text-white rounded-xl resize-none"
              placeholder="Comentarios adicionales..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-full transition-colors"
          >
            {editingCliente ? 'Guardar Cambios' : 'Registrar Cliente'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
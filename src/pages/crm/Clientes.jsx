import React, { useState, useMemo } from 'react'
import { useClientes } from '../../hooks/useClientes'
import { useDebounced } from '../../hooks/useDebounced'
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

  const debouncedSearch = useDebounced(searchTerm)
  const filteredClientes = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(term) ||
      (c.cuit && c.cuit.includes(debouncedSearch))
    )
  }, [clientes, debouncedSearch])

  const headers = ['Nombre', 'CUIT / DNI', 'Teléfono', 'Email', 'Notas', 'Acciones']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-neutral-400">Cargando Clientes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">Directorio de Clientes</h1>
          <p className="text-xs text-neutral-500 font-normal">Base de datos de clientes históricos del balneario.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-semibold text-xs rounded transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo Cliente
        </button>
      </div>

      {/* Filter and search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o CUIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-[#E5E5E5] focus:border-black outline-none text-xs bg-white rounded"
        />
      </div>

      {/* Main Table */}
      <DataTable
        headers={headers}
        data={filteredClientes}
        emptyMessage="No se encontraron clientes."
        renderRow={(cliente) => (
          <tr key={cliente.id} className="hover:bg-[#F9F9F9] transition-colors">
            <td className="p-4 font-bold uppercase text-black">{cliente.nombre}</td>
            <td className="p-4 font-medium">{cliente.cuit || '-'}</td>
            <td className="p-4">{cliente.telefono || '-'}</td>
            <td className="p-4 lowercase text-neutral-600">{cliente.mail || '-'}</td>
            <td className="p-4 max-w-[200px] truncate text-neutral-500">{cliente.notas || '-'}</td>
            <td className="p-4 flex gap-2">
              <button onClick={() => handleOpenEdit(cliente)} className="p-1.5 hover:bg-[#E5E5E5] rounded text-black" title="Editar">
                <Edit2 size={15} />
              </button>
              <button onClick={() => handleDelete(cliente.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Borrar">
                <Trash2 size={15} />
              </button>
            </td>
          </tr>
        )}
        renderMobileCard={(cliente) => (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold uppercase text-xs text-black">{cliente.nombre}</h3>
                <p className="text-[11px] text-neutral-500">CUIT: {cliente.cuit || '-'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(cliente)} className="p-1 text-black">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(cliente.id)} className="p-1 text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="text-xs space-y-1 border-t border-[#E5E5E5] pt-2 text-neutral-700">
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
            <label className="text-xs font-semibold text-neutral-600">Nombre Completo *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black outline-none text-xs uppercase rounded font-semibold"
              placeholder="Ej. JUAN PÉREZ"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black outline-none text-xs rounded"
                placeholder="+54 9..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">CUIT / DNI</label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black outline-none text-xs rounded"
                placeholder="20-12345678-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Email</label>
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black outline-none text-xs lowercase rounded"
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Notas / Comentarios</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black outline-none text-xs rounded resize-none"
              placeholder="Comentarios adicionales..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded transition-colors"
          >
            {editingCliente ? 'Guardar Cambios' : 'Registrar Cliente'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
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
      alert('Error guardando cliente. Por favor intente nuevamente.')
    }
  }

  const handleDelete = async (id) => {
    if (confirm('¿Está seguro de eliminar este cliente? Se perderá la relación con futuras reservas.')) {
      try {
        await deleteCliente(id)
      } catch (err) {
        alert('No se pudo borrar el cliente')
      }
    }
  }

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cuit && c.cuit.includes(searchTerm))
  )

  const headers = ['Nombre', 'CUIT', 'Teléfono', 'Mail', 'Notas', 'Acciones']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs uppercase tracking-widest font-semibold text-neutral-400">Cargando Clientes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl uppercase tracking-wider font-extrabold font-display">Clientes</h1>
          <p className="text-xs text-neutral-500">Administración de la cartera histórica del balneario.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-3 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-sm"
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
          className="w-full pl-10 pr-4 py-3 border border-[#E5E5E5] focus:border-black outline-none text-xs uppercase bg-white rounded-sm"
        />
      </div>

      {/* Main Table */}
      <DataTable
        headers={headers}
        data={filteredClientes}
        emptyMessage="No se encontraron clientes registrados con ese criterio."
        renderRow={(cliente) => (
          <tr key={cliente.id} className="hover:bg-neutral-50">
            <td className="p-4 font-bold uppercase">{cliente.nombre}</td>
            <td className="p-4">{cliente.cuit || '-'}</td>
            <td className="p-4">{cliente.telefono || '-'}</td>
            <td className="p-4 lowercase">{cliente.mail || '-'}</td>
            <td className="p-4 max-w-[200px] truncate">{cliente.notas || '-'}</td>
            <td className="p-4 flex gap-3">
              <button onClick={() => handleOpenEdit(cliente)} className="text-black hover:text-[#F2CA50]" title="Editar">
                <Edit2 size={15} />
              </button>
              <button onClick={() => handleDelete(cliente.id)} className="text-neutral-400 hover:text-red-600" title="Borrar">
                <Trash2 size={15} />
              </button>
            </td>
          </tr>
        )}
        renderMobileCard={(cliente) => (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold uppercase text-xs">{cliente.nombre}</h3>
                <p className="text-[10px] text-neutral-500">CUIT: {cliente.cuit || '-'}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleOpenEdit(cliente)} className="text-black">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(cliente.id)} className="text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="text-[11px] space-y-1 border-t border-neutral-100 pt-2 text-neutral-700">
              <p><strong>Tel:</strong> {cliente.telefono || '-'}</p>
              <p><strong>Mail:</strong> {cliente.mail || '-'}</p>
              {cliente.notas && <p><strong>Notas:</strong> {cliente.notas}</p>}
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Nombre Completo *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E5E5E5] focus:border-black outline-none text-xs uppercase"
              placeholder="e.g. BALTASAR BRUSCHETTI"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E5E5E5] focus:border-black outline-none text-xs"
                placeholder="+54 9..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">CUIT / DNI</label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E5E5E5] focus:border-black outline-none text-xs"
                placeholder="20-12345678-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Email</label>
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E5E5E5] focus:border-black outline-none text-xs lowercase"
              placeholder="ejemplo@correo.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Notas / Comentarios</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E5E5E5] focus:border-black outline-none text-xs resize-none"
              placeholder="Anotaciones extra sobre el cliente..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-black hover:bg-black/90 text-white font-bold text-xs uppercase tracking-widest rounded-sm"
          >
            {editingCliente ? 'Guardar Cambios' : 'Registrar Cliente'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
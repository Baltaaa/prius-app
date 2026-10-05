import { useState } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import Modal from '../crm/Modal'
import ClienteSelector from '../crm/ClienteSelector'
import MoneyInput from '../inputs/MoneyInput'
import { unidadEmoji } from '../../lib/format'

// Asignar una unidad libre a un cliente de temporada, SIN salir del Plano —
// mismo ClienteSelector (existente o nuevo) que usa Reservas.jsx (ítem 5,
// oct 2026). Antes esto navegaba a Clientes.jsx, que solo permitía crear un
// cliente nuevo, nunca elegir uno ya existente.
export default function AsignarUnidadModal({ isOpen, onClose, unit, temporadaActiva }) {
  const { createReserva } = useData()
  const { alert } = useDialog()
  const [clienteId, setClienteId] = useState('')
  const [valorTotal, setValorTotal] = useState(0)
  const [bonificada, setBonificada] = useState(false)
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId || !unit?.dbId) return
    setSaving(true)
    try {
      await createReserva({
        cliente_id: clienteId,
        unidad_id: unit.dbId,
        tipo_alquiler: 'temporada',
        estado: 'activa',
        origen: 'manual',
        valor_total: bonificada ? 0 : Number(valorTotal || 0),
        bonificada,
        notas,
      })
      onClose()
    } catch (err) {
      await alert(err.message || 'No se pudo asignar la unidad.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Asignar ${unidadEmoji(unit?.type)} ${unit?.type === 'sombrilla' ? 'Sombrilla' : 'Carpa'} #${unit?.number}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliente</label>
          <ClienteSelector value={clienteId} onChange={(id) => setClienteId(id)} autoFocus />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</label>
          <p className="text-sm text-white">{temporadaActiva?.nombre || '—'}</p>
        </div>
        <MoneyInput
          label="Monto Total"
          value={bonificada ? 0 : valorTotal}
          onChange={setValorTotal}
          disabled={bonificada}
          max={100_000_000}
          hint={bonificada ? 'Carpa bonificada: sin cargo, no registra pagos.' : undefined}
        />
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={bonificada} onChange={(e) => setBonificada(e.target.checked)} className="accent-cyan-400 w-4 h-4" />
          Unidad bonificada
        </label>
        <button
          type="submit"
          disabled={!clienteId || saving}
          className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
        >
          {saving ? 'Asignando...' : 'Asignar Unidad'}
        </button>
      </form>
    </Modal>
  )
}

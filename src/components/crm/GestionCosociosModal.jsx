import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import Modal from './Modal'
import ClienteSelector from './ClienteSelector'
import LoadingButton from '../ui/LoadingButton'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { coSocios } from '../../lib/reservas'

// Ítem 3 (25/10/2026): agregar/quitar cosocios de una reserva, desde la
// ficha de Reservas y el panel de unidad del Plano (mismo modal en los dos
// lugares). Agregar: cliente existente o alta rápida (ClienteSelector, ya
// valida con el módulo único). Quitar: bloqueado si ese cosocio ya tiene
// algún pago vigente registrado en esta reserva — no se puede desvincular
// a alguien que ya puso plata ahí sin perder el rastro de quién pagó qué.
export default function GestionCosociosModal({ isOpen, onClose, reserva, pagos = [] }) {
  const { agregarCosocio, quitarCosocio } = useData()
  const { toast, confirm, alert } = useDialog()
  const [nuevoId, setNuevoId] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [quitandoId, setQuitandoId] = useState(null)

  if (!reserva) return null
  const socios = coSocios(reserva)

  const tienePagos = (clienteId) => pagos.some((p) => p.cliente_id === clienteId && p.estado === 'vigente')

  const handleAgregar = async () => {
    if (!nuevoId) return
    setAgregando(true)
    try {
      await agregarCosocio(reserva.id, nuevoId)
      setNuevoId('')
      toast('Cosocio agregado', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo agregar el cosocio.', { tone: 'error' })
    } finally {
      setAgregando(false)
    }
  }

  const handleQuitar = async (cliente) => {
    if (tienePagos(cliente.id)) {
      await alert(`${cliente.nombre} ya tiene pagos registrados en esta reserva — no se puede quitar.`, { title: 'No se puede quitar' })
      return
    }
    const ok = await confirm(`¿Quitar a ${cliente.nombre} de esta reserva?`, { title: 'Quitar cosocio' })
    if (!ok) return
    setQuitandoId(cliente.id)
    try {
      await quitarCosocio(reserva.id, cliente.id)
      toast('Cosocio quitado', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo quitar el cosocio.', { tone: 'error' })
    } finally {
      setQuitandoId(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cosocios" maxWidthClass="sm:max-w-sm">
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Titular</p>
        <div className="px-3 py-2.5 bg-prius-subtle border border-hairline rounded-xl text-sm font-semibold text-black">
          {reserva.clientes?.nombre || 'S/N'}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Cosocios ({socios.length})</p>
        {socios.length === 0 ? (
          <p className="text-xs text-prius-muted">Sin cosocios todavía.</p>
        ) : (
          <div className="space-y-2">
            {socios.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-prius-subtle border border-hairline rounded-xl">
                <span className="text-sm font-semibold text-black truncate">{s.nombre}</span>
                <button
                  type="button"
                  onClick={() => handleQuitar(s)}
                  disabled={quitandoId === s.id}
                  title={tienePagos(s.id) ? 'Tiene pagos registrados — no se puede quitar' : 'Quitar'}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-prius-error hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Agregar cosocio</p>
        <ClienteSelector value={nuevoId} onChange={(id) => setNuevoId(id)} />
        <LoadingButton
          loading={agregando}
          loadingText="Agregando..."
          disabled={!nuevoId}
          onClick={handleAgregar}
          className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <UserPlus size={14} /> Agregar
        </LoadingButton>
      </div>
    </Modal>
  )
}

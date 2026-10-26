import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import Modal from './Modal'
import StatusBadge from './StatusBadge'
import BrandSelect from '../ui/BrandSelect'
import TextInput from '../inputs/TextInput'
import LoadingButton from '../ui/LoadingButton'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'

const OPCIONES_ESTADO = [
  { value: 'pendiente', label: 'Sin pago' },
  { value: 'parcial', label: 'Seña parcial' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'pendiente_confirmacion', label: 'Sin confirmar' },
]

// Ítem 2 (25/10/2026): modal único para "Cambiar estado de pago" — se
// reutiliza en la ficha de Reservas y en el panel de unidad del Plano
// (mismo patrón que RegistrarPago.jsx, un solo componente para los dos
// lugares). Solo superadmin: el botón que lo abre ya está gateado con
// usePermiso('ajustar_estado_pago') en cada lugar que lo usa, y la RPC
// rechaza igual del lado del servidor si alguien más intenta llamarla.
export default function CambiarEstadoPagoModal({ isOpen, onClose, reserva }) {
  const { cambiarEstadoPagoManual, revertirEstadoPagoAutomatico } = useData()
  const { toast } = useDialog()
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [revirtiendo, setRevirtiendo] = useState(false)

  useEffect(() => {
    if (!isOpen || !reserva) return
    setNuevoEstado(reserva.estado_pago || 'pendiente')
    setMotivo('')
    setSaving(false)
  }, [isOpen, reserva])

  if (!reserva) return null

  const handleConfirmar = async () => {
    if (!motivo.trim()) return
    setSaving(true)
    try {
      await cambiarEstadoPagoManual(reserva.id, nuevoEstado, motivo.trim())
      toast('Estado de pago actualizado', { tone: 'success' })
      onClose()
    } catch (err) {
      toast(err.message || 'No se pudo cambiar el estado de pago.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleVolverAutomatico = async () => {
    setRevirtiendo(true)
    try {
      await revertirEstadoPagoAutomatico(reserva.id)
      toast('Vuelve a calcularse automático', { tone: 'success' })
      onClose()
    } catch (err) {
      toast(err.message || 'No se pudo revertir el ajuste.', { tone: 'error' })
    } finally {
      setRevirtiendo(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar estado de pago"
      maxWidthClass="sm:max-w-sm"
      footer={
        <LoadingButton
          loading={saving}
          loadingText="Guardando..."
          disabled={!motivo.trim()}
          onClick={handleConfirmar}
          className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all"
        >
          Guardar ajuste
        </LoadingButton>
      }
    >
      <div className="flex items-start gap-2 p-3 bg-gold/5 border border-gold/20 rounded-xl">
        <ShieldAlert size={16} className="text-gold shrink-0 mt-0.5" />
        <p className="text-xs text-prius-slate">
          Esto no modifica pagos ni comprobantes — solo cambia la etiqueta de estado que ve el equipo, hasta que se registre un pago nuevo o lo revierta un superadmin.
        </p>
      </div>

      {reserva.estado_pago_manual && (
        <div className="p-3 bg-prius-subtle border border-hairline rounded-xl space-y-2">
          <p className="text-xs text-prius-slate">
            Ajustado manualmente{reserva.estado_pago_manual_motivo ? ` — ${reserva.estado_pago_manual_motivo}` : ''}.
          </p>
          <button
            type="button"
            onClick={handleVolverAutomatico}
            disabled={revirtiendo}
            className="text-[11px] font-bold uppercase tracking-widest text-gold hover:text-black transition-colors disabled:opacity-50"
          >
            {revirtiendo ? 'Revirtiendo...' : 'Volver al estado automático'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-prius-slate">Estado actual</span>
        <StatusBadge status={reserva.estado_pago} />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Nuevo estado</label>
        <BrandSelect value={nuevoEstado} onChange={setNuevoEstado} options={OPCIONES_ESTADO} />
      </div>

      <TextInput
        as="textarea"
        rows={3}
        label="Motivo (obligatorio)"
        value={motivo}
        onChange={setMotivo}
        maxLength={300}
        placeholder="Ej. Acordamos un plan de pago distinto con el cliente"
        required
      />
    </Modal>
  )
}

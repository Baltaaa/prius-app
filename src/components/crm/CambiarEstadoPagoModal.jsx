import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import Modal from './Modal'
import ConfirmarSuperadminModal from './ConfirmarSuperadminModal'
import StatusBadge from './StatusBadge'
import BrandSelect from '../ui/BrandSelect'
import TextInput from '../inputs/TextInput'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'

const OPCIONES_ESTADO = [
  { value: 'pendiente', label: 'Sin pago' },
  { value: 'parcial', label: 'Pago parcial' },
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
  // Mini-prompt 26/10/2026: las dos acciones de este modal piden contraseña
  // de superadmin — "Guardar ajuste" solo ABRE el gate si el motivo ya está
  // cargado; "Volver al estado automático" lo abre directo. El loading
  // durante la verificación lo muestra ConfirmarSuperadminModal, no este botón.
  const [confirmarAjuste, setConfirmarAjuste] = useState(false)
  const [confirmarRevertir, setConfirmarRevertir] = useState(false)

  useEffect(() => {
    if (!isOpen || !reserva) return
    setNuevoEstado(reserva.estado_pago || 'pendiente')
    setMotivo('')
  }, [isOpen, reserva])

  if (!reserva) return null

  const handleConfirmar = () => {
    if (!motivo.trim()) return
    setConfirmarAjuste(true)
  }

  const handleConfirmAjuste = async (password) => {
    await cambiarEstadoPagoManual(reserva.id, nuevoEstado, motivo.trim(), password)
    toast('Estado de pago actualizado', { tone: 'success' })
    setConfirmarAjuste(false)
    onClose()
  }

  const handleVolverAutomatico = () => setConfirmarRevertir(true)

  const handleConfirmRevertir = async (password) => {
    await revertirEstadoPagoAutomatico(reserva.id, password)
    toast('Vuelve a calcularse automático', { tone: 'success' })
    setConfirmarRevertir(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar estado de pago"
      maxWidthClass="sm:max-w-sm"
      footer={
        <button
          type="button"
          disabled={!motivo.trim()}
          onClick={handleConfirmar}
          className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all"
        >
          Guardar ajuste
        </button>
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
            className="text-[11px] font-bold uppercase tracking-widest text-gold hover:text-black transition-colors"
          >
            Volver al estado automático
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

      <ConfirmarSuperadminModal
        isOpen={confirmarAjuste}
        onClose={() => setConfirmarAjuste(false)}
        onConfirm={handleConfirmAjuste}
        titulo="Cambiar estado de pago"
        afectaLinea={`Nuevo estado: ${OPCIONES_ESTADO.find((o) => o.value === nuevoEstado)?.label || nuevoEstado} — ${motivo.trim()}`}
        confirmLabel="Guardar ajuste"
      />
      <ConfirmarSuperadminModal
        isOpen={confirmarRevertir}
        onClose={() => setConfirmarRevertir(false)}
        onConfirm={handleConfirmRevertir}
        titulo="Volver al estado automático"
        afectaLinea="El estado de pago vuelve a calcularse solo, a partir de los pagos reales."
        confirmLabel="Confirmar"
      />
    </Modal>
  )
}

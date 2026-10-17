import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'

// Confirmación reforzada para cualquier borrado de dato raíz (reservas,
// clientes, unidades): a diferencia de useDialog().confirm() (un simple
// Confirmar/Cancelar), acá el botón queda deshabilitado hasta que el usuario
// tipea exacto el identificador de lo que está por borrar — pensado para
// hard deletes reales, no para soft deletes como "Cancelar reserva".
//
// Props:
//   isOpen, onClose, onConfirm (async)
//   tipo: label humano de lo que se borra, ej. "reserva", "cliente", "unidad"
//   identificador: string exacto que el usuario tiene que tipear para habilitar
//   detalle: texto opcional con contexto adicional (ej. "3 pagos asociados")
//   accion: 'eliminar' (default, hard delete irreversible) | 'cancelar'
//     (soft delete reversible — mismo gate de tipeo, framing menos alarmante)
export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, tipo, identificador, detalle, accion = 'eliminar' }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const overlayId = useId()
  const { bind } = useOverlay({
    id: `confirmdelete-${overlayId}`,
    isOpen,
    onRequestClose: () => !loading && onClose?.(),
  })

  useEffect(() => {
    if (isOpen) setInput('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  const esCancelar = accion === 'cancelar'
  const matches = input === identificador
  const handleConfirm = async () => {
    if (!matches || loading) return
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => !loading && onClose?.()}
    >
      <div
        ref={bind}
        className="card-light w-full max-w-sm rounded-2xl border border-red-500/20 shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10 text-prius-error">
            <AlertTriangle size={18} />
          </div>
          <div className="pt-1 min-w-0 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-black">
              {esCancelar ? 'Cancelar' : 'Eliminar'} {tipo}
            </h3>
            <p className="text-sm text-prius-slate mt-2">
              {esCancelar
                ? 'Para confirmar, escribí exactamente:'
                : 'Esta acción no se puede deshacer. Para confirmar, escribí exactamente:'}
            </p>
            <p className="text-sm font-bold text-prius-error mt-2 break-words">{identificador}</p>
            {detalle && <p className="text-xs text-prius-muted mt-2">{detalle}</p>}
          </div>
          <button
            onClick={() => !loading && onClose?.()}
            className="p-1.5 hover:bg-prius-subtle rounded-lg text-prius-muted hover:text-black transition-all shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoFocus
          className="w-full px-4 py-3 bg-prius-subtle border border-hairline rounded-xl focus:border-red-500/50 outline-none text-base md:text-sm text-black placeholder-white/20"
          placeholder={identificador}
        />

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-prius-slate bg-prius-subtle hover:bg-prius-subtle border border-hairline transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!matches || loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-red-500 hover:bg-red-400 text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500"
          >
            {loading
              ? (esCancelar ? 'Cancelando...' : 'Eliminando...')
              : (esCancelar ? 'Cancelar reserva' : 'Eliminar definitivamente')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

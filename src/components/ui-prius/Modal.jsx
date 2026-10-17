import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'
import { useDialog } from '../../context/DialogProvider'

// Modal del sistema "Playa Privada": mismo mecanismo que crm/Modal.jsx
// (portal a document.body, overlay manager, isDirty opcional) pero con el
// look claro — scrim negro 40% sin blur, panel blanco borde hairline sin
// sombra, rounded-2xl desktop / rounded-t-2xl mobile.
export default function Modal({ isOpen, onClose, title, children, maxWidthClass = 'sm:max-w-lg', footer, isDirty }) {
  const overlayId = useId()
  const { confirm } = useDialog()

  const requestClose = async () => {
    if (isDirty?.()) {
      const ok = await confirm('Tenés cambios sin guardar. ¿Descartarlos?', { title: 'Descartar cambios' })
      if (!ok) return
    }
    onClose?.()
  }

  const { bind } = useOverlay({ id: `prius-modal-${overlayId}`, isOpen, onRequestClose: requestClose })

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-black/40 animate-in fade-in duration-200"
      onClick={requestClose}
    >
      <div
        ref={bind}
        className={`bg-white w-full ${maxWidthClass} max-h-[92vh] sm:max-h-[90dvh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden border border-hairline animate-in slide-in-from-bottom sm:zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-hairline" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline shrink-0">
          <h2 className="text-headline-sm text-black font-ui">{title}</h2>
          <button
            onClick={requestClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-prius-subtle rounded-xl text-prius-slate hover:text-black transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-ui">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-hairline bg-prius-subtle p-4 sm:p-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'

// Sheet siempre anclado abajo (a diferencia de Modal, que en desktop se
// centra) — para pickers, menús "Más" y selectores cortos. `maxHeightClass`
// por defecto deja margen arriba para que nunca quede pegado al borde
// superior del viewport (date pickers largos incluidos).
export default function BottomSheet({ isOpen, onClose, title, children, maxHeightClass = 'max-h-[85vh]' }) {
  const overlayId = useId()
  const { bind } = useOverlay({ id: `prius-sheet-${overlayId}`, isOpen, onRequestClose: () => onClose?.() })

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[998] flex items-end justify-center bg-black/40 animate-in fade-in duration-200"
      onClick={() => onClose?.()}
    >
      <div
        ref={bind}
        className={`w-full sm:max-w-md bg-white border-t border-hairline sm:border sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden ${maxHeightClass} animate-in slide-in-from-bottom duration-200`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-hairline" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-3 shrink-0">
            <h2 className="text-label-lg uppercase text-black font-ui">{title}</h2>
            <button
              onClick={() => onClose?.()}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-prius-subtle rounded-xl text-prius-slate"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 pb-4 font-ui">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

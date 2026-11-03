import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'
import { useMountTransition } from '../../hooks/useMountTransition'
import { useKeyboardInset, centrarCampoEnfocado } from '../../hooks/useKeyboardInset'

// Sheet siempre anclado abajo (a diferencia de Modal, que en desktop se
// centra) — para pickers, menús "Más" y selectores cortos. `maxHeightClass`
// por defecto deja margen arriba para que nunca quede pegado al borde
// superior del viewport (date pickers largos incluidos).
export default function BottomSheet({ isOpen, onClose, title, children, maxHeightClass = 'max-h-[90dvh]' }) {
  const overlayId = useId()
  const { bind } = useOverlay({ id: `prius-sheet-${overlayId}`, isOpen, onRequestClose: () => onClose?.() })

  const shouldRender = useMountTransition(isOpen)
  const tecladoPx = useKeyboardInset(shouldRender)
  if (!shouldRender) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[998] flex items-end justify-center bg-overlay backdrop-blur-sm ${isOpen ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      onClick={() => onClose?.()}
      onFocus={centrarCampoEnfocado}
      style={{ paddingBottom: tecladoPx || undefined }}
    >
      <div
        ref={bind}
        className={`w-full sm:max-w-md bg-card sm:rounded-card rounded-t-card flex flex-col overflow-hidden ${maxHeightClass} ${isOpen ? 'ui-open-sheet' : 'ui-close-sheet'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-3 shrink-0">
            <h2 className="text-card-title text-ink">{title}</h2>
            <button
              onClick={() => onClose?.()}
              aria-label="Cerrar"
              className="btn-icon text-ink-2"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

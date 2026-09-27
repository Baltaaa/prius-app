import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Se monta en un portal sobre document.body: las páginas del CRM viven dentro
// de contenedores con `transform` (animate-premium-fade), y un `position: fixed`
// adentro de un ancestro con transform queda atrapado en ese recuadro en vez de
// cubrir el viewport. El portal lo saca de ahí y el overlay tapa/blurea todo.
export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Mobile: bottom sheet de altura completa (mismo patrón que
  // UnidadPreviewModal.jsx — gesto de cierre arriba, esquinas redondeadas
  // solo arriba, scroll interno). Desktop: modal centrado sin cambios.
  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-card w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gesto de cierre (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 shrink-0">
          <h2 className="text-sm uppercase font-bold tracking-[0.2em] text-[#FDE047]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

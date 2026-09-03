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

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg max-h-[90vh] rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 shrink-0">
          <h2 className="text-sm uppercase font-bold tracking-[0.2em] text-[#FDE047]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

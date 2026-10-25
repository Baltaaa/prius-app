import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'
import { useDialog } from '../../context/DialogProvider'
import { useMountTransition } from '../../hooks/useMountTransition'

// Se monta en un portal sobre document.body: las páginas del CRM viven dentro
// de contenedores con `transform` (animate-premium-fade), y un `position: fixed`
// adentro de un ancestro con transform queda atrapado en ese recuadro en vez de
// cubrir el viewport. El portal lo saca de ahí y el overlay tapa/blurea todo.
// `maxWidthClass`/`footer` (oct 2026, Tarea 5): opt-in, default igual al
// comportamiento de siempre — así los demás modales de la app (Clientes,
// RegistrarPago, etc.) no cambian un píxel. `footer`, si se pasa, queda
// sticky abajo (fuera del body con scroll), para modales anchos con mucho
// contenido como "Nueva reserva".
// `isDirty` (opt-in, Tarea 1 oct 2026): función que devuelve true si el
// formulario de adentro tiene cambios sin guardar. Si se pasa y hay
// cambios, cerrar por click afuera o Escape pide confirmación primero
// ("¿Descartar cambios?") en vez de cerrar directo — sin `isDirty`, cierra
// igual que siempre (default = comportamiento de antes).
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

  // Click afuera + Escape vía el mecanismo central (Tarea 1) — un Modal
  // siempre se trata como overlay de primer nivel salvo que el manager
  // detecte que su trigger quedó adentro de otro ya abierto (ej. abrir un
  // ConfirmDeleteModal desde dentro de este Modal).
  const { bind } = useOverlay({ id: `modal-${overlayId}`, isOpen, onRequestClose: requestClose })

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const shouldRender = useMountTransition(isOpen)
  if (!shouldRender) return null

  // Mobile: bottom sheet de altura completa (mismo patrón que
  // UnidadPreviewModal.jsx — gesto de cierre arriba, esquinas redondeadas
  // solo arriba, scroll interno). Desktop: modal centrado sin cambios.
  return createPortal(
    <div
      className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md ${isOpen ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      onClick={requestClose}
    >
      <div
        ref={bind}
        className={`card-light w-full ${maxWidthClass} max-h-[92dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden border border-hairline shadow-2xl ${isOpen ? 'ui-open-sheet sm:ui-open' : 'ui-close-sheet sm:ui-close'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gesto de cierre (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-prius-subtle" />
        </div>

        {/* Header compacto en mobile (pulido mobile iPhone, oct 2026): franja
            baja fondo blanco (antes p-6 + bg-prius-subtle era un bloque gris
            alto) — desktop sin cambios (sm:p-6 sm:bg-prius-subtle, igual que
            siempre). */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-hairline bg-white sm:bg-prius-subtle shrink-0">
          <h2 className="text-sm uppercase font-bold tracking-[0.2em] text-gold">{title}</h2>
          <button
            onClick={requestClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-prius-subtle rounded-lg text-prius-muted hover:text-black transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6 sm:p-8 space-y-6">
          {children}
        </div>

        {/* Footer sticky (pulido mobile iPhone, oct 2026): safe-area-inset-bottom
            para que el botón de confirmar nunca quede tapado por la barra de
            Safari/home indicator. */}
        {footer && (
          <div
            className="shrink-0 border-t border-hairline bg-white sm:bg-prius-subtle p-4 sm:p-6"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

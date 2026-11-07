import { useKeyboardInset, centrarCampoEnfocado } from '../../hooks/useKeyboardInset'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay, OverlayParentContext } from '../../context/OverlayProvider'
import { useDialog } from '../../context/DialogProvider'
import { useMountTransition } from '../../hooks/useMountTransition'
import ScrollFade from '../ui/ScrollFade'

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
  const modalOverlayId = `modal-${overlayId}`
  const { bind } = useOverlay({ id: modalOverlayId, isOpen, onRequestClose: requestClose })

  // Regla única de cierre por overlay (31/10/2026): solo cierra si el
  // mousedown Y el mouseup ocurren sobre el overlay mismo. Antes era un
  // `onClick={requestClose}` en el overlay, y como los eventos de React se
  // propagan por el ÁRBOL DE REACT (no el DOM), un click dentro de un
  // dropdown en portal —que es hijo React del modal— subía hasta acá y
  // cerraba el modal entero. También cubre el caso de arrastrar desde
  // adentro del modal y soltar afuera, que no debe cerrar.
  const mouseDownEnOverlayRef = useRef(false)
  const handleOverlayMouseDown = (e) => { mouseDownEnOverlayRef.current = e.target === e.currentTarget }
  const handleOverlayMouseUp = (e) => {
    const cierra = mouseDownEnOverlayRef.current && e.target === e.currentTarget
    mouseDownEnOverlayRef.current = false
    if (cierra) requestClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const shouldRender = useMountTransition(isOpen)
  const tecladoPx = useKeyboardInset(shouldRender)
  if (!shouldRender) return null

  // Mobile: bottom sheet de altura completa (mismo patrón que
  // UnidadPreviewModal.jsx — gesto de cierre arriba, esquinas redondeadas
  // solo arriba, scroll interno). Desktop: modal centrado sin cambios.
  return createPortal(
    <OverlayParentContext.Provider value={modalOverlayId}>
    <div
      className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-overlay backdrop-blur-sm ${isOpen ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      onFocus={centrarCampoEnfocado}
      style={{ paddingBottom: tecladoPx || undefined }}
    >
      <div
        ref={bind}
        className={`capa-elevada bg-card w-full ${maxWidthClass} max-h-[90dvh] rounded-t-card sm:rounded-card flex flex-col overflow-hidden ${isOpen ? 'ui-open-sheet sm:ui-open' : 'ui-close-sheet sm:ui-close'}`}
      >
        {/* Gesto de cierre (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface" />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 sm:px-8 pt-3 sm:pt-7 pb-3 shrink-0">
          <h2 className="text-card-title sm:text-modal-title text-ink min-w-0">{title}</h2>
          <button onClick={requestClose} aria-label="Cerrar" className="btn-icon text-ink-2 -mr-2 shrink-0">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <ScrollFade wrapperClassName="flex-1" className="overflow-y-auto overscroll-contain px-4 sm:px-8 pt-1 pb-6 sm:pb-8 space-y-5">
          {children}
        </ScrollFade>

        {/* Footer sticky (pulido mobile iPhone, oct 2026): safe-area-inset-bottom
            para que el botón de confirmar nunca quede tapado por la barra de
            Safari/home indicator. */}
        {footer && (
          <div
            className="shrink-0 border-t border-divider bg-card px-4 sm:px-8 py-4 sm:py-5"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
    </OverlayParentContext.Provider>,
    document.body,
  )
}

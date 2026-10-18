import { useId } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'
import { useMountTransition } from '../../hooks/useMountTransition'

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Aviso "¿Seguís ahí?" antes del cierre por inactividad (Tarea 3, oct 2026).
// Excepción explícita a la regla general de overlays: acá el click afuera
// cuenta como "Seguir conectado" (es la acción segura), no como cierre.
export default function InactivityWarningModal({ open, secondsLeft, onContinuar, onCerrarSesion }) {
  const overlayId = useId()
  const { bind } = useOverlay({ id: `inactivity-warning-${overlayId}`, isOpen: open, onRequestClose: onContinuar })

  const shouldRender = useMountTransition(open)
  if (!shouldRender) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[1200] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md ${open ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      onClick={onContinuar}
      role="presentation"
    >
      <div
        ref={bind}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-warning-title"
        aria-describedby="inactivity-warning-desc"
        className={`card-light w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-hairline shadow-2xl p-6 sm:p-8 space-y-6 ${open ? 'ui-open-sheet sm:ui-open' : 'ui-close-sheet sm:ui-close'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center -mt-2 mb-1">
          <div className="w-10 h-1 rounded-full bg-prius-subtle" />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-gold" />
          </div>
          <h2 id="inactivity-warning-title" className="text-lg font-bold text-black">¿Seguís ahí?</h2>
        </div>

        <p id="inactivity-warning-desc" className="text-sm text-prius-muted leading-relaxed" aria-live="polite">
          Por seguridad, tu sesión se cerrará en <span className="text-gold font-bold tabular-nums">{formatMMSS(secondsLeft)}</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onContinuar}
            autoFocus
            className="order-1 sm:order-2 flex-1 h-12 min-h-[44px] bg-gold hover:bg-gold-hover active:scale-[0.98] text-black font-bold text-sm rounded-xl transition-all"
          >
            Seguir conectado
          </button>
          <button
            type="button"
            onClick={onCerrarSesion}
            className="order-2 sm:order-1 flex-1 h-12 min-h-[44px] bg-prius-subtle hover:bg-prius-subtle border border-hairline text-prius-slate font-bold text-sm rounded-xl transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { useOverlay, useOverlayTop } from './OverlayProvider'

// Reemplazo propio de window.confirm/window.alert: los diálogos nativos
// congelan la pestaña completa (ni siquiera se puede sacar un screenshot
// mientras están abiertos) y rompen el branding Glass Dark. Un solo modal
// montado acá arriba del árbol, expuesto vía useDialog() — confirm() y
// alert() devuelven una Promise para poder seguir usando `if (await confirm(...))`
// en el mismo lugar donde antes iba `if (confirm(...))`.
const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)

  // Toast discreto, no bloqueante (Tarea 1, oct 2026) — para avisos chicos
  // como "no se encontró el registro" de un deep-link, donde el modal de
  // alert() de arriba sería demasiado intrusivo. Se apila abajo a la
  // derecha y se auto-descarta a los 4s, sin necesidad de que el usuario
  // haga nada.
  // `tone` (testing oct 2026, item 13): 'success' | 'error' | 'info'
  // (default) — mismo toast de siempre, ahora con color/ícono distintivo
  // para que un guardado exitoso y un error se distingan de un vistazo sin
  // tener que leer el texto. Sigue siendo el único sistema de toast de la
  // app (no se suma sonner/shadcn ni un segundo mecanismo en paralelo).
  // `action` (30/10/2026, punto 8): { label, onClick } opcional — un toast
  // accionable, para avisos donde además hay algo para hacer (ej. "reserva
  // escaneada desde el celular" -> "Abrir en Recepción"). Dura más que un
  // toast normal, porque hay que llegar a clickearlo.
  const toast = useCallback((message, opts = {}) => {
    const id = ++toastIdRef.current
    const tone = opts.tone || 'info'
    const action = opts.action || null
    setToasts((prev) => [...prev, { id, message, tone, action }])
    const ms = action ? 10000 : tone === 'error' ? 6000 : 4000
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ms)
  }, [])

  const cerrarToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({ mode: 'confirm', message, title: opts.title || 'Confirmar', tone: opts.tone || 'danger', resolve })
    })
  }, [])

  const alert = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({ mode: 'alert', message, title: opts.title || 'Aviso', tone: opts.tone || 'error', resolve })
    })
  }, [])

  const close = (result) => {
    dialog?.resolve?.(result)
    setDialog(null)
  }

  // Click afuera + Escape vía el mecanismo central (Tarea 1, oct 2026) —
  // antes no tenía Escape. Sin trigger DOM (se dispara desde código, no de
  // un click visible): se ancla como hijo de lo que estuviera abierto en
  // ese momento (ej. el Modal que llamó a confirm() al intentar cerrarse
  // con cambios sin guardar) vía `parentId` explícito — así clickear
  // afuera de este diálogo no intenta cerrar también al padre.
  const peekTop = useOverlayTop()
  const parentIdRef = useRef(null)
  if (dialog && parentIdRef.current === null) parentIdRef.current = peekTop()
  if (!dialog) parentIdRef.current = null
  const { bind } = useOverlay({
    id: 'app-dialog',
    isOpen: !!dialog,
    onRequestClose: () => close(dialog?.mode === 'confirm' ? false : undefined),
    parentId: parentIdRef.current || undefined,
  })

  const isDanger = dialog?.tone === 'danger' || dialog?.tone === 'error'

  return (
    <DialogContext.Provider value={{ confirm, alert, toast }}>
      {children}
      {toasts.length > 0 && createPortal(
        <div className="fixed bottom-4 right-4 z-[1100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className="surface-pop px-4 py-3 text-body flex items-start gap-2.5 ui-open">
              {t.tone === 'success' && <CheckCircle2 size={18} strokeWidth={1.5} className="shrink-0 mt-px text-success-ink" />}
              {t.tone === 'error' && <AlertTriangle size={18} strokeWidth={1.5} className="shrink-0 mt-px text-danger" />}
              <span className="text-ink flex-1 min-w-0">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action.onClick?.(); cerrarToast(t.id) }}
                  className="btn btn-primary shrink-0 self-center h-8 min-h-0 px-3 text-label"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
      {dialog && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-overlay backdrop-blur-sm ui-backdrop-open"
          onClick={() => close(dialog.mode === 'confirm' ? false : undefined)}
        >
          <div
            ref={bind}
            className="bg-card w-full max-w-sm rounded-card p-6 sm:p-8 space-y-5 ui-open"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-icon flex items-center justify-center shrink-0 ${isDanger ? 'bg-danger-soft text-danger' : 'bg-gold-100 text-ink'}`}>
                {isDanger ? <AlertTriangle size={20} strokeWidth={1.5} /> : <Info size={20} strokeWidth={1.5} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-card-title text-ink">{dialog.title}</h3>
                <p className="text-body text-ink-2 mt-2 whitespace-pre-line">{dialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              {dialog.mode === 'confirm' && (
                <button onClick={() => close(false)} className="btn btn-ghost">Cancelar</button>
              )}
              <button
                onClick={() => close(dialog.mode === 'confirm' ? true : undefined)}
                className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
              >
                {dialog.mode === 'confirm' ? 'Confirmar' : 'Entendido'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>')
  return ctx
}

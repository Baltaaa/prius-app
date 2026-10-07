import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info } from 'lucide-react'
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
  const toast = useCallback((message) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
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
            <div
              key={t.id}
              className="glass-card rounded-xl border border-white/10 shadow-2xl px-4 py-3 text-sm text-gray-200 animate-premium-fade"
            >
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
      {dialog && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => close(dialog.mode === 'confirm' ? false : undefined)}
        >
          <div
            ref={bind}
            className="glass-card w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-500/10 text-red-400' : 'bg-[#FDE047]/10 text-[#FDE047]'}`}>
                {isDanger ? <AlertTriangle size={18} /> : <Info size={18} />}
              </div>
              <div className="pt-1 min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">{dialog.title}</h3>
                <p className="text-sm text-gray-300 mt-2 whitespace-pre-line">{dialog.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              {dialog.mode === 'confirm' && (
                <button
                  onClick={() => close(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => close(dialog.mode === 'confirm' ? true : undefined)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isDanger ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-[#FDE047] hover:bg-yellow-300 text-black'}`}
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

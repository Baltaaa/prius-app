import { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info } from 'lucide-react'

// Reemplazo propio de window.confirm/window.alert: los diálogos nativos
// congelan la pestaña completa (ni siquiera se puede sacar un screenshot
// mientras están abiertos) y rompen el branding Glass Dark. Un solo modal
// montado acá arriba del árbol, expuesto vía useDialog() — confirm() y
// alert() devuelven una Promise para poder seguir usando `if (await confirm(...))`
// en el mismo lugar donde antes iba `if (confirm(...))`.
const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)

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

  const isDanger = dialog?.tone === 'danger' || dialog?.tone === 'error'

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => close(dialog.mode === 'confirm' ? false : undefined)}
        >
          <div
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

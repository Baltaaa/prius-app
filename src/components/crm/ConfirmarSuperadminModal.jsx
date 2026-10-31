import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Eye, EyeOff, X } from 'lucide-react'
import { useOverlay, OverlayParentContext } from '../../context/OverlayProvider'
import { useMountTransition } from '../../hooks/useMountTransition'

// Confirmación única para TODA acción de superadmin (mini-prompt
// 26/10/2026) — reemplaza a ConfirmDeleteModal.jsx ("escribí el nombre
// para confirmar") para las acciones realmente sensibles: reingresar la
// contraseña del superadmin logueado, verificada del lado servidor (Edge
// Function `superadmin-action`, nunca solo acá) antes de ejecutar nada.
// La sesión del browser no se toca en ningún momento — ver el comentario
// en la Edge Function sobre el cliente descartable que hace el
// signInWithPassword.
//
// `onConfirm(password)` (no `accion`/`params` acá): el caller ya tiene en
// DataProvider.jsx la función específica de la acción (deleteReserva,
// anularPago, reabrirCaja, etc.), que internamente llama
// ejecutarAccionSuperadmin Y hace el refetch/update de su propio estado
// local — este modal solo junta la contraseña y delega, para no duplicar
// esa lógica de sincronización acá.
//
// Props:
//   isOpen, onClose
//   onConfirm(password) — async; si tira, el mensaje se muestra debajo del
//     campo sin cerrar el modal (contraseña incorrecta, bloqueado, etc.)
//   titulo: nombre de la acción, ej. "Eliminar reserva"
//   afectaLinea: una sola línea de qué se va a afectar, ej.
//     "Reserva de MARCELO MADOTTA · carpa #2 y sus pagos asociados"
//   confirmLabel: texto del botón de confirmar, ej. "Eliminar definitivamente"
export default function ConfirmarSuperadminModal({
  isOpen, onClose, onConfirm, titulo, afectaLinea, confirmLabel = 'Confirmar',
}) {
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const overlayId = useId()

  const handleClose = () => {
    if (loading) return
    setPassword('')
    setError(null)
    setMostrarPassword(false)
    onClose?.()
  }

  const confirmOverlayId = `confirmar-superadmin-${overlayId}`
  // Misma regla de cierre que Modal.jsx (31/10/2026): mousedown Y mouseup
  // sobre el overlay mismo. Ver el comentario largo allá.
  const mouseDownEnOverlayRef = useRef(false)
  const { bind } = useOverlay({
    id: confirmOverlayId,
    isOpen,
    onRequestClose: handleClose,
  })

  // Limpiar el campo al abrir/cerrar — la contraseña nunca queda en el
  // estado más tiempo del necesario (y nunca se persiste ni se loguea acá).
  useEffect(() => {
    if (isOpen) { setPassword(''); setError(null); setMostrarPassword(false) }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const shouldRender = useMountTransition(isOpen)
  if (!shouldRender) return null

  const handleConfirm = async () => {
    if (!password || loading) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm?.(password)
      setPassword('')
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <OverlayParentContext.Provider value={confirmOverlayId}>
    <div
      className={`fixed inset-0 z-[1000] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md ${isOpen ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      onMouseDown={(e) => { mouseDownEnOverlayRef.current = e.target === e.currentTarget }}
      onMouseUp={(e) => {
        const cierra = mouseDownEnOverlayRef.current && e.target === e.currentTarget
        mouseDownEnOverlayRef.current = false
        if (cierra) handleClose()
      }}
    >
      {/* Footer de botones (ítem 2, mini-prompt 26/10/2026): SIEMPRE dentro
          del mismo `p-6` que el resto del contenido — nunca un wrapper con
          su propio padding/márgenes aparte que pudiera desalinearlo. Mobile
          (<sm): columna invertida, Confirmar arriba, ancho completo,
          apilados. Desktop (sm+): dos columnas de igual ancho/alto. */}
      <div
        ref={bind}
        className={`card-light w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-red-500/20 shadow-2xl p-6 space-y-5 ${isOpen ? 'ui-open-sheet sm:ui-open' : 'ui-close-sheet sm:ui-close'}`}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10 text-prius-error">
            <AlertTriangle size={18} />
          </div>
          <div className="pt-1 min-w-0 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-black">{titulo}</h3>
            {afectaLinea && <p className="text-sm text-prius-slate mt-2 break-words">{afectaLinea}</p>}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-prius-subtle rounded-lg text-prius-muted hover:text-black transition-all shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-prius-slate mb-1.5">
            Contraseña de superadmin
          </label>
          <div className="relative">
            <input
              type={mostrarPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              disabled={loading}
              autoFocus
              autoComplete="current-password"
              className={`w-full px-4 py-3 pr-12 bg-prius-subtle border rounded-xl outline-none text-base md:text-sm text-black placeholder-prius-muted ${error ? 'border-prius-error' : 'border-hairline focus:border-red-500/50'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-prius-muted hover:text-black transition-colors"
              title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-prius-error mt-1.5">{error}</p>}
        </div>

        <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="h-11 px-2 rounded-xl text-xs font-bold uppercase tracking-wide text-prius-slate bg-prius-subtle hover:bg-prius-subtle border border-hairline transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!password || loading}
            className="h-11 px-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all bg-red-500 hover:bg-red-400 text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500 whitespace-nowrap overflow-hidden"
          >
            {loading ? 'Verificando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </OverlayParentContext.Provider>,
    document.body,
  )
}

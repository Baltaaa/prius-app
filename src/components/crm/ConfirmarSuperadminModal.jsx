import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Eye, EyeOff, X } from 'lucide-react'
import { useOverlay, OverlayParentContext } from '../../context/OverlayProvider'
import { useMountTransition } from '../../hooks/useMountTransition'
import { FuncionError, MENSAJE_GENERICO } from '../../lib/invocarFuncion'

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
//   onConfirm(password) — async; si tira, el mensaje (en español, ver
//     invocarFuncion.ts) se muestra debajo del campo sin cerrar el modal ni
//     perder lo tipeado: contraseña incorrecta, bloqueado, sin conexión. Ante
//     un error de conexión el botón pasa a "Reintentar".
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
  const [errorConexion, setErrorConexion] = useState(false)
  // Guard síncrono contra doble envío (el estado `loading` recién se ve en el
  // próximo render: un Enter + click en el mismo tick pasaba los dos).
  const enviandoRef = useRef(false)
  const overlayId = useId()

  const handleClose = () => {
    if (loading) return
    setPassword('')
    setError(null)
    setErrorConexion(false)
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
    if (isOpen) { setPassword(''); setError(null); setErrorConexion(false); setMostrarPassword(false) }
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
    if (!password || loading || enviandoRef.current) return
    enviandoRef.current = true
    setLoading(true)
    setError(null)
    setErrorConexion(false)
    try {
      await onConfirm?.(password)
      setPassword('')
    } catch (err) {
      // Solo se muestran mensajes ya traducidos (FuncionError); cualquier otra
      // excepción cae al genérico en español, nunca un mensaje técnico.
      const conocido = err instanceof FuncionError
      setError(conocido ? err.message : MENSAJE_GENERICO)
      setErrorConexion(conocido && err.esConexion)
    } finally {
      enviandoRef.current = false
      setLoading(false)
    }
  }

  return createPortal(
    <OverlayParentContext.Provider value={confirmOverlayId}>
    <div
      className={`fixed inset-0 z-[1000] flex items-end sm:items-center justify-center sm:p-4 bg-overlay backdrop-blur-sm ${isOpen ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
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
        className={`card-surface w-full sm:max-w-md rounded-t-card sm:rounded-card border-danger/30 p-6 space-y-5 ${isOpen ? 'ui-open-sheet sm:ui-open' : 'ui-close-sheet sm:ui-close'}`}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-inner flex items-center justify-center shrink-0 bg-danger-soft text-danger">
            <AlertTriangle size={18} />
          </div>
          <div className="pt-1 min-w-0 flex-1">
            <h3 className="text-label text-ink">{titulo}</h3>
            {afectaLinea && <p className="text-body text-ink-2 mt-2 break-words">{afectaLinea}</p>}
          </div>
          <button
            onClick={handleClose}
            className="btn-icon text-ink-2 hover:text-ink shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="text-label block text-ink-2 mb-2">
            Contraseña de superadmin
          </label>
          <div className="relative">
            <input
              type={mostrarPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); setErrorConexion(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              disabled={loading}
              autoFocus
              autoComplete="off"
              className={`w-full px-4 py-3 pr-12 bg-surface rounded-inner outline-none text-base md:text-body text-ink placeholder-ink-2 border border-transparent focus:ring-2 focus:ring-gold ${error ? 'border-danger' : 'border-line focus:border-danger/30'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-ink-2 hover:text-ink transition-colors"
              title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-label text-danger mt-2">{error}</p>}
        </div>

        <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-label h-11 px-2 rounded-full text-ink-2 hover:bg-surface transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!password || loading}
            className="text-label h-11 px-2 rounded-full transition-all bg-danger hover:bg-danger text-on-ink disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-danger whitespace-nowrap overflow-hidden"
          >
            {loading ? 'Verificando...' : errorConexion ? 'Reintentar' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </OverlayParentContext.Provider>,
    document.body,
  )
}

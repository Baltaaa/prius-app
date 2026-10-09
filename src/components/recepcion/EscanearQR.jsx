import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { X, CameraOff } from 'lucide-react'
import { useOverlay } from '../../context/OverlayProvider'

// Bottom sheet de pantalla completa con la cámara trasera leyendo un QR de
// reserva (Tarea 5). No usa <Modal> (que tiene max-width/padding pensados
// para formularios) porque la cámara necesita el viewport completo — pero
// registra el mismo mecanismo de overlays (click afuera / Escape) que el
// resto de la app.
export default function EscanearQR({ isOpen, onClose, onScan }) {
  const overlayId = useId()
  const { bind } = useOverlay({ id: `escanear-qr-${overlayId}`, isOpen, onRequestClose: () => onClose?.() })
  const elementId = `qr-reader-${overlayId}`
  const scannerRef = useRef(null)
  const [permisoDenegado, setPermisoDenegado] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPermisoDenegado(false)
    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner
    let detenido = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 230 },
        (textoLeido) => {
          if (detenido) return
          detenido = true
          onScan?.(textoLeido)
        },
        () => {}, // frame sin QR legible — ignorar, no es un error
      )
      .catch(() => setPermisoDenegado(true))

    return () => {
      detenido = true
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-black flex flex-col animate-in fade-in duration-200">
      <div ref={bind} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] shrink-0">
          <h2 className="text-sm uppercase font-bold tracking-[0.2em] text-[#FDE047]">Escanear QR</h2>
          <button
            onClick={() => onClose?.()}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {permisoDenegado ? (
            <div className="text-center space-y-3 max-w-sm">
              <CameraOff className="mx-auto text-gray-500" size={32} />
              <p className="text-sm text-gray-300">
                No pudimos acceder a la cámara. Revisá los permisos del navegador, o tipeá el código a mano.
              </p>
            </div>
          ) : (
            <div id={elementId} className="w-full max-w-sm rounded-2xl overflow-hidden" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

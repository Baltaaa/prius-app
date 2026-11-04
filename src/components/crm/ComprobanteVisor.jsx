import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import ComprobanteDocumento from './ComprobanteDocumento'
import ZoomPanPinch from '../ui/ZoomPanPinch'
import { useOverlay } from '../../context/OverlayProvider'
import { useMountTransition } from '../../hooks/useMountTransition'

// Visor del comprobante a pantalla completa (mobile): pinch zoom y arrastre con
// las mismas reglas que el Plano mobile (ZoomPanPinch): el zoom mínimo encuadra
// y centra el documento entero, nunca se achica más; máximo ~3x; rebote en los
// bordes; doble tap acerca. Se cierra con el botón o con Escape.
export default function ComprobanteVisor({ isOpen, onClose, datos, tipo = 'estado_cuenta' }) {
  const { bind } = useOverlay({ id: 'comprobante-visor', isOpen, onRequestClose: () => onClose?.() })
  const montado = useMountTransition(isOpen)
  if (!montado) return null
  return createPortal(
    <div
      ref={bind}
      role="dialog"
      aria-label="Comprobante a pantalla completa"
      className={`fixed inset-0 z-[998] bg-canvas flex flex-col ${isOpen ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="shrink-0 flex items-center justify-between px-page py-2">
        <p className="text-label text-ink-2">Pellizcá para acercar · arrastrá para mover</p>
        <button type="button" onClick={() => onClose?.()} aria-label="Cerrar" className="btn-icon bg-card border border-line">
          <X size={18} />
        </button>
      </div>
      <ZoomPanPinch reservaDerecha={0} className="mx-page mb-3 rounded-card bg-surface">
        <div className="hoja-comprobante">
          <ComprobanteDocumento datos={datos} tipo={tipo} />
        </div>
      </ZoomPanPinch>
    </div>,
    document.body,
  )
}

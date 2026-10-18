import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { useOverlay } from "../../context/OverlayProvider"
import { useMountTransition } from "../../hooks/useMountTransition"
import UnidadDetalleContent from "./UnidadDetalleContent"

// Hoja inferior de detalle de unidad — tablet y mobile (<1024px). Desktop
// usa el panel lateral fijo en cambio (UnidadDetallePanel.jsx, mismo
// contenido vía UnidadDetalleContent.jsx) — `lg:hidden` en el wrapper del
// portal para que, aunque React la siga montando, no se vea ni intercepte
// clicks en ≥1024px (Dashboard.jsx decide cuál mostrar, pero ambas quedan
// en el árbol para no romper el `useOverlay`/Escape de la que esté activa).
export default function UnidadPreviewModal({ unit, reservas, temporadaActiva, onClose, onAsignarTemporada, onMoverUnidad }) {
  const overlayId = useId()
  const { bind } = useOverlay({ id: `unidad-preview-${overlayId}`, isOpen: !!unit, onRequestClose: () => onClose?.() })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  const shouldRender = useMountTransition(!!unit)
  // Igual que ClienteDrawer: `unit` llega en null para señalizar el cierre,
  // así que se congela la última unidad real mientras dura la animación de
  // salida — si no, el contenido desaparecía de golpe en vez de verse cerrar.
  const lastUnitRef = useRef(unit)
  if (unit) lastUnitRef.current = unit
  const unitActiva = unit ?? lastUnitRef.current

  if (!shouldRender) return null

  return createPortal(
    <div
      className={`lg:hidden fixed inset-0 z-[999] flex items-end justify-center bg-black/40 ${unit ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
      onClick={() => onClose?.()}
    >
      <div
        ref={bind}
        className={`w-full max-h-[85vh] bg-white rounded-t-3xl flex flex-col overflow-hidden border-t border-hairline ${unit ? 'ui-open-sheet' : 'ui-close-sheet'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-hairline" />
        </div>
        <div className="flex-1 overflow-y-auto px-space-lg pb-space-lg flex flex-col min-h-0">
          <UnidadDetalleContent
            unit={unitActiva}
            reservas={reservas}
            temporadaActiva={temporadaActiva}
            onClose={onClose}
            onAsignarTemporada={onAsignarTemporada}
            onMoverUnidad={onMoverUnidad}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

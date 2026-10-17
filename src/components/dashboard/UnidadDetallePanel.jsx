import { LayoutList } from "lucide-react"
import UnidadDetalleContent from "./UnidadDetalleContent"

// Panel lateral fijo de detalle de unidad — solo desktop (≥1024px, mock
// 02-plano-desktop). Reemplaza al modal SOLO en este breakpoint; tablet y
// mobile siguen usando UnidadPreviewModal.jsx como hoja inferior (ver
// Dashboard.jsx, que decide cuál de los dos montar según el ancho). Mismo
// contenido/datos/handlers que el modal — ver UnidadDetalleContent.jsx.
export default function UnidadDetallePanel({ unit, reservas, temporadaActiva, onClose, onAsignarTemporada, onMoverUnidad }) {
  return (
    <aside className="hidden lg:flex w-96 shrink-0 card-light rounded-2xl p-space-lg flex-col overflow-hidden">
      {unit ? (
        <UnidadDetalleContent
          unit={unit}
          reservas={reservas}
          temporadaActiva={temporadaActiva}
          onClose={onClose}
          onAsignarTemporada={onAsignarTemporada}
          onMoverUnidad={onMoverUnidad}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-prius-muted">
          <LayoutList size={28} />
          <p className="text-body-md">Tocá una unidad para ver el detalle</p>
        </div>
      )}
    </aside>
  )
}

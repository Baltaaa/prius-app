import { LayoutList } from "lucide-react"
import UnidadDetalleContent from "./UnidadDetalleContent"

// Panel lateral fijo de detalle de unidad — solo desktop (≥1024px, mock
// 02-plano-desktop). Reemplaza al modal SOLO en este breakpoint; tablet y
// mobile siguen usando UnidadPreviewModal.jsx como hoja inferior (ver
// Dashboard.jsx, que decide cuál de los dos montar según el ancho). Mismo
// contenido/datos/handlers que el modal — ver UnidadDetalleContent.jsx.
export default function UnidadDetallePanel({ unit, reservas, temporadaActiva, onClose, onAsignarTemporada, onMoverUnidad }) {
  // Sin padding en la card: el inset (px-card) lo llevan el encabezado y el
  // cuerpo scrolleable, así la barra de scroll queda pegada al borde de la card
  // (con su lugar reservado, `scroll-fino`) y nunca se come el padding ni deja
  // los valores tocando el borde derecho. El cuerpo llega hasta el borde
  // inferior y el overflow-hidden respeta el radio de la card.
  return (
    <aside className="card-surface hidden lg:flex w-96 shrink-0 flex-col overflow-hidden">
      {unit ? (
        <UnidadDetalleContent
          unit={unit}
          reservas={reservas}
          temporadaActiva={temporadaActiva}
          onClose={onClose}
          onAsignarTemporada={onAsignarTemporada}
          onMoverUnidad={onMoverUnidad}
          headerClassName="px-card pt-card"
          bodyClassName="px-card pb-card scroll-fino"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-ink-2 p-card">
          <LayoutList size={28} />
          <p className="text-body">Tocá una unidad para ver el detalle</p>
        </div>
      )}
    </aside>
  )
}

import { Layers } from "lucide-react"
import PlanoGrid from "../plano/PlanoGrid"
import PlanoViewport from "../plano/PlanoViewport"
import PlanoZoomBar from "./PlanoZoomBar"
import { PlanoControles, PlanoAcciones } from "./PlanoFiltros"

// Plano mobile (<768px, mock 02-plano-mobile) — componente NUEVO y separado
// del layout desktop/tablet de Dashboard.jsx: nunca edita ni reimplementa
// PlanoGrid.jsx/PlanoViewport.jsx (los importa y los usa tal cual, vía los
// mismos props/handlers que ya calcula Dashboard.jsx — mismas unidades,
// mismo orden, misma disposición real). `renderCelda` que recibe ya es
// renderCeldaMobile (CellMobile.jsx, celda táctil real ≥44x36 — ver ese
// archivo y Dashboard.jsx), nunca Cell.jsx escalado. La grilla de
// "Pasillo A-B-C/D-E-F" del mock es un placeholder inventado por Stitch, acá
// se dibuja la disposición real vía `renderCelda`/`unidades`.
export default function PlanoMobile({
  selectedDate, esHoy, onPrevDay, onNextDay, onHoy, onDateChange,
  planoStats, loading, estadoFiltro, onEstado, tipoFiltro, onTipo, onImprimir,
  transform, ready, isDragging, canPan,
  onZoomIn, onZoomOut, onEncuadrar, onTouchStart, onTouchMove, onTouchEnd,
  onMapMouseDown, onMapWheel, onAnimationEnd, viewportRef, contentRef,
  unidades, renderCelda, extraButtonsViewport,
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Controles compartidos con desktop/tablet (PlanoFiltros.jsx): fecha a
          ancho completo, tiles-filtro 2x2 y segmented de tipo a ancho
          completo, todo con targets de 44px. La leyenda vive en "Referencias". */}
      <div className="shrink-0">
        <PlanoControles
          selectedDate={selectedDate}
          esHoy={esHoy}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
          onHoy={onHoy}
          onDateChange={onDateChange}
          planoStats={planoStats}
          estadoFiltro={estadoFiltro}
          onEstado={onEstado}
          tipoFiltro={tipoFiltro}
          onTipo={onTipo}
          onImprimir={onImprimir}
          compacto
          anchoFecha="w-[164px]"
        />
      </div>

      {/* Card del plano — PlanoGrid/PlanoViewport SIN modificar */}
      <section data-card-compacta className="card-surface flex-1 min-h-0 relative overflow-hidden flex flex-col p-3 gap-3">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <span className="flex items-center gap-2 text-ink-2 min-w-0">
            <Layers size={14} className="shrink-0" />
            <span className="text-label truncate">Pasillo A · B · C</span>
          </span>
          <PlanoAcciones onImprimir={onImprimir} />
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ink-2 text-label">Cargando plano…</div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-3">
            {/* Misma técnica que Dashboard.jsx desktop: la barra de zoom
                propia de PlanoViewport.jsx (congelado) se oculta desde
                afuera con este selector, sin tocar ese archivo —
                PlanoZoomBar.jsx la reemplaza al lado, dentro del padding de
                la card, nunca superpuesta a una celda. */}
            <div className="flex-1 min-h-0 flex flex-col relative [&>div:first-child]:hidden">
              <PlanoViewport
                transform={transform}
                ready={ready}
                isDragging={isDragging}
                canPan={canPan}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onEncuadrar={onEncuadrar}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMapMouseDown={onMapMouseDown}
                onMapWheel={onMapWheel}
                onAnimationEnd={onAnimationEnd}
                viewportRef={viewportRef}
                contentRef={contentRef}
              >
                <PlanoGrid unidades={unidades} renderCelda={renderCelda} />
              </PlanoViewport>
            </div>
            <PlanoZoomBar onZoomIn={onZoomIn} onZoomOut={onZoomOut} onEncuadrar={onEncuadrar} extraButtons={extraButtonsViewport} />
          </div>
        )}
      </section>
    </div>
  )
}


import { useRef } from "react"
import { Layers } from "lucide-react"
import PlanoGrid from "../plano/PlanoGrid"
import PlanoRotable from "./PlanoRotable"
import ZoomPanPinch from "../ui/ZoomPanPinch"
import PlanoZoomPill from "./PlanoZoomPill"
import { PlanoControles, PlanoStatTiles } from "./PlanoFiltros"
import ToolbarSticky from "../brand/ToolbarSticky"

// Plano mobile (<768px) — componente NUEVO y separado del layout
// desktop/tablet de Dashboard.jsx. La pantalla NO scrollea: el mapa ocupa todo
// el alto disponible (100dvh menos topbar, controles compactos y bottom nav),
// así el scroll de la página nunca compite con los gestos del mapa.
//
// El mapa es ZoomPanPinch (gestos propios: arrastre, pinch anclado, doble
// tap, límites con rebote, arranca encuadrado y centrado) con el PlanoGrid sin
// modificar adentro. `renderCelda` que recibe es renderCeldaMobile
// (CellMobile.jsx, celda táctil real ≥44x36) — nunca Cell.jsx escalado. El
// zoom/pan de desktop y tablet (PlanoViewport + estado en Dashboard.jsx) no se
// usa acá.
export default function PlanoMobile({
  selectedDate, esHoy, onPrevDay, onNextDay, onHoy, onDateChange,
  planoStats, loading, estadoFiltro, onEstado, tipoFiltro, onTipo, onImprimir, onImprimirCliente,
  rotado, onRotar, fullscreen, onToggleFullscreen, slideRef, onAnimationEnd,
  unidades, renderCelda,
}) {
  const mapa = useRef(null)
  const controles = (
    <PlanoControles
      selectedDate={selectedDate}
      esHoy={esHoy}
      onPrevDay={onPrevDay}
      onNextDay={onNextDay}
      onHoy={onHoy}
      onDateChange={onDateChange}
      tipoFiltro={tipoFiltro}
      onTipo={onTipo}
      onImprimir={onImprimir}
      onImprimirCliente={onImprimirCliente}
      compacto
      modoCliente={fullscreen}
    />
  )
  return (
    <div className="plano-mobile-root flex-1 min-h-0 flex flex-col gap-3">
      {/* Controles compartidos con desktop/tablet (PlanoFiltros.jsx). En la
          vista normal viven en la fila de pills de la barra única
          (ToolbarSticky -> PageTopbar), así el mapa se queda con todo el alto;
          en pantalla completa van en su propia franja, porque ahí el shell de
          la app no está montado. La leyenda vive en "Referencias". */}
      {fullscreen ? (
        <div className="plano-mobile-controles shrink-0 flex items-center gap-2 overflow-x-auto scroll-x-snap">{controles}</div>
      ) : (
        <ToolbarSticky>{controles}</ToolbarSticky>
      )}

      {/* Tiles-filtro de estado: las stats SON los filtros (CLAUDE.md). */}
      {!fullscreen && (
        <PlanoStatTiles
          className="plano-mobile-controles shrink-0"
          stats={planoStats}
          valor={estadoFiltro}
          onChange={onEstado}
          fecha={selectedDate}
          compacto
        />
      )}

      {/* Card del plano — PlanoGrid SIN modificar */}
      <section data-card-compacta className="card-surface flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col p-3 gap-3">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <span className="flex items-center gap-2 text-ink-2 min-w-0">
            <Layers size={14} className="shrink-0" />
            <span className="text-label truncate">Pasillo A · B · C</span>
          </span>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ink-2 text-label">Cargando plano…</div>
        ) : (
          <div className="flex-1 min-h-0 relative flex flex-col">
            {/* Hoja del mapa: sigue el tema activo (ver Dashboard.jsx). */}
            <div className="plano-hoja flex-1 min-h-0 flex flex-col">
            <ZoomPanPinch
              ref={mapa}
              resetKey={`${estadoFiltro ?? ""}|${tipoFiltro ?? ""}`}
              slideRef={slideRef}
              onAnimationEnd={onAnimationEnd}
            >
              <PlanoRotable rotado={rotado}>
                <PlanoGrid unidades={unidades} renderCelda={renderCelda} mar={fullscreen} />
              </PlanoRotable>
            </ZoomPanPinch>
            </div>
            <PlanoZoomPill
              className="absolute top-0 right-0 z-10"
              onZoomIn={() => mapa.current?.acercar()}
              onZoomOut={() => mapa.current?.alejar()}
              onEncuadrar={() => mapa.current?.encuadrar()}
              onRotar={onRotar}
              rotado={rotado}
              fullscreen={fullscreen}
              onToggleFullscreen={onToggleFullscreen}
            />
          </div>
        )}
      </section>
    </div>
  )
}

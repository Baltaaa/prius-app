import { Plus, Minus, Scan } from "lucide-react"

// Contenedor con zoom del Plano, extraído tal cual de Dashboard.jsx (Fase
// 4A, oct 2026). Totalmente controlado por props — no guarda ningún estado
// propio — así que si quien lo monta se desmonta y vuelve a montar (ver
// Dashboard.jsx: el modal de pantalla completa monta una instancia nueva)
// el zoom/pan no se resetea: ese estado vive en el padre, no acá.
//
// Dos modos, elegidos por `isFitMode` (igual que hoy):
//   - Mobile (<768px): pinch-to-zoom táctil + botones +/-, `touchAction:
//     pan-x pan-y`, scroll nativo para el pan, `transform: scale(zoom)`.
//   - Desktop/tablet (>=768px, fit-to-container): pan por drag de mouse +
//     Ctrl+rueda, botón extra "Encuadrar", `transform: translate(x,y)
//     scale(scale)` con el centrado calculado a mano por el padre.
// Quien lo usa decide cuál corre pasando los handlers correspondientes
// (los que no aplican al modo activo, se pasan `undefined`).
export default function PlanoViewport({
  isFitMode,
  zoom,
  transform,
  ready,
  isDragging,
  canPan,
  onZoomIn,
  onZoomOut,
  onEncuadrar,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMapMouseDown,
  onMapWheel,
  onAnimationEnd,
  viewportRef,
  contentRef,
  extraButtons,
  children,
}) {
  return (
    <>
      <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
        <button onClick={onZoomIn} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-[#FDE047] hover:text-black transition-all">
          <Plus size={20} />
        </button>
        <button onClick={onZoomOut} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-[#FDE047] hover:text-black transition-all">
          <Minus size={20} />
        </button>
        {isFitMode && (
          <button onClick={onEncuadrar} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all" title="Encuadrar">
            <Scan size={18} />
          </button>
        )}
        {extraButtons}
      </div>

      <div
        ref={viewportRef}
        onAnimationEnd={onAnimationEnd}
        onTouchStart={!isFitMode ? onTouchStart : undefined}
        onTouchMove={!isFitMode ? onTouchMove : undefined}
        onTouchEnd={!isFitMode ? onTouchEnd : undefined}
        onMouseDown={isFitMode ? onMapMouseDown : undefined}
        onWheel={isFitMode ? onMapWheel : undefined}
        style={!isFitMode ? { touchAction: "pan-x pan-y" } : { visibility: ready ? "visible" : "hidden" }}
        className={
          isFitMode
            ? "flex-1 min-h-0 overflow-hidden relative"
            : "flex-1 overflow-auto p-4 sm:p-12 flex justify-center items-start"
        }
      >
        <div
          ref={contentRef}
          className={isFitMode ? "absolute top-0 left-0 flex flex-col items-center" : "transition-transform duration-200 origin-top flex flex-col items-center"}
          style={
            isFitMode
              ? {
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: "0 0",
                  transition: isDragging ? "none" : "transform 150ms ease-out",
                  cursor: canPan ? (isDragging ? "grabbing" : "grab") : "default",
                }
              : { transform: `scale(${zoom})` }
          }
        >
          {children}
        </div>
      </div>
    </>
  )
}

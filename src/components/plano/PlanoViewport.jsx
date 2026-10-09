import { Plus, Minus, Scan } from "lucide-react"

// Contenedor con zoom del Plano (Fase 4A, hotfix mobile oct 2026). Un solo
// modo de interacción para cualquier tamaño de pantalla — fit-to-container,
// con pan por drag (mouse o un dedo) y zoom relativo al punto tocado/
// clickeado (Ctrl+rueda en desktop, pellizco con dos dedos en mobile) —
// nunca un modo "scroll nativo + escala simple" aparte: mobile y desktop
// alimentan exactamente el mismo estado `transform` del padre.
//
// Totalmente controlado por props — no guarda ningún estado propio — así
// que si quien lo monta se desmonta y vuelve a montar (ver Dashboard.jsx:
// el modal de pantalla completa monta una instancia nueva) el zoom/pan no
// se resetea: ese estado vive en el padre, no acá.
//
// `touch-action: none` en el contenedor: todo el gesto (pan de un dedo,
// pinch de dos) lo calcula el JS del padre vía los handlers — ninguna
// gestión nativa del navegador (scroll, zoom de página) debe interferir.
export default function PlanoViewport({
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
        <button onClick={onEncuadrar} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all" title="Encuadrar">
          <Scan size={18} />
        </button>
        {extraButtons}
      </div>

      <div
        ref={viewportRef}
        onAnimationEnd={onAnimationEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMapMouseDown}
        onWheel={onMapWheel}
        // visibility: hidden hasta la primera medición válida (`ready`):
        // sin esto se llega a ver un frame con el plano sin escalar (cortado
        // arriba, o más ancho que el viewport) antes de que el
        // useLayoutEffect del padre corra.
        style={{ touchAction: "none", visibility: ready ? "visible" : "hidden" }}
        className="flex-1 min-h-0 overflow-hidden relative"
      >
        <div
          ref={contentRef}
          className="absolute top-0 left-0 flex flex-col items-center"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
            transition: isDragging ? "none" : "transform 150ms ease-out",
            cursor: canPan ? (isDragging ? "grabbing" : "grab") : "default",
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}

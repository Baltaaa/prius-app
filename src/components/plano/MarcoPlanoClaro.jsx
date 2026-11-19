import { useRef } from "react"
import { Layers, X } from "lucide-react"
import PlanoViewport from "./PlanoViewport"
import ZoomPanPinch from "./ZoomPanPinch"
import { BarraZoomPlano, PillZoomPlano } from "./ControlesZoomPlano"

// Marco de la "vista clientes" del Plano (Fase 6A, nov 2026): el mismo que el
// modal de pantalla completa del CRM y el que la landing usa como marco de
// todo el flujo de reserva. Sin datos: todo llega por props y el cuerpo
// (PlanoClaro) por children. Portable: solo react, lucide-react y esta carpeta.
//
// variante="amplia" (desktop/tablet, ≥768px):
//   header: [logo] [selectorFecha] [Todo | Carpas | Sombrillas] ........ [X]
//   cuerpo: card con "Pasillo A · B · C", el mapa (PlanoViewport, controlado
//   por `encuadre` = usePlanoEncuadre()) y la columna +, −, Encuadrar, Rotar.
// variante="compacta" (mobile, <768px):
//   fila: [selectorFecha] [Todo | Carpas | Sombrillas] (scroll horizontal)
//   cuerpo: card con el mapa en ZoomPanPinch (gestos propios) y la pill
//   flotante +, −, Encuadrar, Rotar y cerrar (Shrink).
//
// El marco ocupa el alto que le dé su contenedor (flex-1 min-h-0): el CRM lo
// monta en su hoja de 90vw×90dvh (100dvh en mobile); la landing, donde quiera.
//
// Colores: claro con valores fijos; `dark:` solo se activa en el CRM.
const TEXTO_SECUNDARIO = "text-[#6B6B6B] dark:text-[rgb(var(--muted-foreground))]"
const CARD = "bg-white rounded-[24px] dark:bg-[rgb(var(--card))]"
const HOJA = "plano-hoja bg-white dark:bg-[rgb(var(--card))]"

// Chips de tipo: mismo dibujo que el SegmentedControl del CRM (pill gris con la
// opción activa en negro). `valor`: null (Todo) | 'carpas' | 'sombrillas'.
function ChipsTipo({ valor, onChange, emojiCarpa = "", emojiSombrilla = "" }) {
  const opciones = [
    { value: null, label: "Todo" },
    { value: "carpas", label: `${emojiCarpa ? `${emojiCarpa} ` : ""}Carpas` },
    { value: "sombrillas", label: `${emojiSombrilla ? `${emojiSombrilla} ` : ""}Sombrillas` },
  ]
  return (
    <div role="group" aria-label="Filtrar el plano por tipo de unidad" className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F2F1EC] dark:bg-[rgb(var(--secondary))]">
      {opciones.map((o) => {
        const activa = (valor ?? null) === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={activa}
            onClick={() => onChange?.(o.value)}
            className={`h-11 md:h-8 min-h-0 px-4 rounded-full text-[13px] leading-[18px] font-medium transition-colors ${
              activa
                ? "bg-black text-white dark:bg-[rgb(var(--primary))] dark:text-[rgb(var(--primary-foreground))]"
                : "text-[#6B6B6B] hover:text-black dark:text-[rgb(var(--muted-foreground))] dark:hover:text-[rgb(var(--primary))]"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function RotuloPasillos({ iconSize }) {
  return (
    <span className={`flex items-center gap-2 min-w-0 ${TEXTO_SECUNDARIO}`}>
      <Layers size={iconSize} className="shrink-0" />
      <span className="text-[13px] leading-[18px] font-medium truncate">Pasillo A · B · C</span>
    </span>
  )
}

export default function MarcoPlanoClaro({
  variante = "amplia",
  logo = null,
  selectorFecha = null,
  tipo = null,
  onTipo,
  emojiCarpa,
  emojiSombrilla,
  onCerrar,
  tituloCerrar = "Cerrar pantalla completa",
  rotado = false,
  onRotar,
  cargando = false,
  encuadre, // amplia: resultado de usePlanoEncuadre()
  resetKey, // compacta: al cambiar, ZoomPanPinch vuelve a encuadrar
  slideRef, // nodo para la animación de cambio de fecha
  onAnimationEnd,
  children, // el cuerpo: <PlanoClaro .../>
}) {
  const mapaCompacto = useRef(null)
  const chips = <ChipsTipo valor={tipo} onChange={onTipo} emojiCarpa={emojiCarpa} emojiSombrilla={emojiSombrilla} />
  const cargandoTexto = <div className={`flex-1 flex items-center justify-center text-[13px] leading-[18px] font-medium ${TEXTO_SECUNDARIO}`}>Cargando plano…</div>

  if (variante === "compacta") {
    return (
      <div className="plano-mobile-root flex-1 min-h-0 flex flex-col gap-3">
        <div className="plano-mobile-controles scroll-x-snap shrink-0 flex items-center gap-2 overflow-x-auto [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:[scroll-snap-align:start]">
          {selectorFecha}
          {chips}
        </div>
        <section data-card-compacta className={`${CARD} flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col p-3 gap-3`}>
          <div className="flex items-center justify-between gap-3 shrink-0">
            <RotuloPasillos iconSize={14} />
          </div>
          {cargando ? cargandoTexto : (
            <div className="flex-1 min-h-0 relative flex flex-col">
              <div className={`${HOJA} flex-1 min-h-0 flex flex-col`}>
                <ZoomPanPinch ref={mapaCompacto} resetKey={resetKey} slideRef={slideRef} onAnimationEnd={onAnimationEnd}>
                  {children}
                </ZoomPanPinch>
              </div>
              <PillZoomPlano
                className="absolute top-0 right-0 z-10"
                onZoomIn={() => mapaCompacto.current?.acercar()}
                onZoomOut={() => mapaCompacto.current?.alejar()}
                onEncuadrar={() => mapaCompacto.current?.encuadrar()}
                onRotar={onRotar}
                rotado={rotado}
                fullscreen
                onToggleFullscreen={onCerrar}
              />
            </div>
          )}
        </section>
      </div>
    )
  }

  // Un solo nodo para el viewport del zoom y la animación de cambio de fecha.
  const setViewport = (node) => {
    if (encuadre) encuadre.viewportRef.current = node
    if (slideRef) slideRef.current = node
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div data-card-compacta className={`${CARD} p-3 shrink-0`}>
        <div className="flex items-center gap-4">
          {logo}
          {selectorFecha}
          {chips}
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              title={tituloCerrar}
              aria-label={tituloCerrar}
              className="ml-auto w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-black hover:bg-[#F2F1EC] dark:text-[rgb(var(--primary))] dark:hover:bg-[rgb(var(--secondary))] transition-colors"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        <section data-card-compacta className={`${CARD} flex-1 relative overflow-hidden flex flex-col p-3 gap-3`}>
          <div className="flex items-center justify-between gap-3 shrink-0">
            <RotuloPasillos iconSize={16} />
            <div className="flex items-center gap-3 shrink-0" />
          </div>
          {cargando || !encuadre ? cargandoTexto : (
            <div className="flex-1 min-h-0 flex gap-3">
              {/* PlanoViewport trae su propia barra de zoom flotante (primer div): se oculta y la
                  reemplaza la columna de al lado, en el flujo del layout. */}
              <div className={`${HOJA} flex-1 min-h-0 flex flex-col relative [&>div:first-child]:hidden`}>
                <PlanoViewport
                  transform={encuadre.transform}
                  ready={encuadre.ready}
                  isDragging={encuadre.isDragging}
                  canPan={encuadre.canPan}
                  onZoomIn={encuadre.handleZoomIn}
                  onZoomOut={encuadre.handleZoomOut}
                  onEncuadrar={encuadre.handleEncuadrar}
                  onTouchStart={encuadre.handleTouchStart}
                  onTouchMove={encuadre.handleTouchMove}
                  onTouchEnd={encuadre.handleTouchEnd}
                  onMapMouseDown={encuadre.handleMapMouseDown}
                  onMapWheel={encuadre.handleMapWheel}
                  onAnimationEnd={onAnimationEnd}
                  viewportRef={setViewport}
                  contentRef={encuadre.contentRef}
                >
                  {children}
                </PlanoViewport>
              </div>
              <BarraZoomPlano
                onZoomIn={encuadre.handleZoomIn}
                onZoomOut={encuadre.handleZoomOut}
                onEncuadrar={encuadre.handleEncuadrar}
                onRotar={onRotar}
                rotado={rotado}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

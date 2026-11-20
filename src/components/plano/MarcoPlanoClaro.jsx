import { useEffect, useImperativeHandle, useRef } from "react"
import { Layers, RefreshCw, X } from "lucide-react"
import PlanoViewport from "./PlanoViewport"
import ZoomPanPinch from "./ZoomPanPinch"
import usePlanoEncuadre from "./usePlanoEncuadre"
import { BarraZoomPlano, PillZoomPlano } from "./ControlesZoomPlano"

// Marco de la "vista clientes" del Plano (Fase 6A, nov 2026): el mismo que el
// modal de pantalla completa del CRM y el que la landing usa como marco de
// todo el flujo de reserva (los 6 pasos, Fase 6A.1). Sin datos: todo llega
// por props y el cuerpo por children. Portable: solo react, lucide-react y
// esta carpeta.
//
// variante="amplia" (desktop/tablet, ≥768px):
//   header: [logo] [selectorFecha] [selectorPersonas] [chips] ... [↻] [X]
//   [barra]
//   cuerpo: mapa (card con "Pasillo A · B · C" + [leyenda], PlanoViewport y la columna
//   +, −, Encuadrar, Rotar) o contenido libre con scroll interno
//   [pie]
// variante="compacta" (mobile, <768px):
//   fila: [selectorFecha] [selectorPersonas] [chips] [↻] (scroll horizontal)
//   [barra]
//   cuerpo: mapa ("Pasillo A · B · C" + [leyenda], ZoomPanPinch y la pill +, −, Encuadrar, Rotar y cerrar) o
//   contenido libre con scroll interno
//   [pie]
//
// Todo lo nuevo de la 6A.1 es opcional: sin esas props el marco dibuja
// exactamente lo mismo que en la 6A (el modal del CRM no las usa).
//
// El marco ocupa el alto que le dé su contenedor (flex-1 min-h-0): el CRM lo
// monta en su hoja de 90vw×90dvh (100dvh en mobile); la landing, donde quiera.
//
// Colores: claro con valores fijos; `dark:` solo se activa en el CRM.
const TEXTO_SECUNDARIO = "text-[#6B6B6B] dark:text-[rgb(var(--muted-foreground))]"
const CARD = "bg-white rounded-[24px] dark:bg-[rgb(var(--card))]"
const HOJA = "plano-hoja bg-white dark:bg-[rgb(var(--card))]"
const BOTON_REDONDO = "w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-black hover:bg-[#F2F1EC] dark:text-[rgb(var(--primary))] dark:hover:bg-[rgb(var(--secondary))] transition-colors"

// Chips de tipo: mismo dibujo que el SegmentedControl del CRM (pill gris con la
// opción activa en negro). `valor`: null (Todo) | 'carpas' | 'sombrillas'.
function ChipsTipo({ valor, onChange, emojiCarpa = "", emojiSombrilla = "", deshabilitados = false }) {
  const opciones = [
    { value: null, label: "Todo" },
    { value: "carpas", label: `${emojiCarpa ? `${emojiCarpa} ` : ""}Carpas` },
    { value: "sombrillas", label: `${emojiSombrilla ? `${emojiSombrilla} ` : ""}Sombrillas` },
  ]
  return (
    <div role="group" aria-label="Filtrar el plano por tipo de unidad" className={`inline-flex items-center gap-1 p-1 rounded-full bg-[#F2F1EC] dark:bg-[rgb(var(--secondary))]${deshabilitados ? " opacity-50" : ""}`}>
      {opciones.map((o) => {
        const activa = (valor ?? null) === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={activa}
            disabled={deshabilitados || undefined}
            onClick={() => onChange?.(o.value)}
            className={`h-11 md:h-8 min-h-0 px-4 rounded-full text-[13px] leading-[18px] font-medium transition-colors ${
              activa
                ? "bg-black text-white dark:bg-[rgb(var(--primary))] dark:text-[rgb(var(--primary-foreground))]"
                : "text-[#6B6B6B] hover:text-black dark:text-[rgb(var(--muted-foreground))] dark:hover:text-[rgb(var(--primary))]"
            }${deshabilitados ? " cursor-default" : ""}`}
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

function BotonRefrescar({ onRefrescar, refrescando, titulo, className = "" }) {
  return (
    <button
      type="button"
      onClick={onRefrescar}
      disabled={refrescando || undefined}
      aria-busy={refrescando || undefined}
      title={titulo}
      aria-label={titulo}
      className={`${className}${BOTON_REDONDO} disabled:cursor-default`}
    >
      <RefreshCw size={18} strokeWidth={1.5} className={refrescando ? "animate-spin motion-reduce:animate-none" : ""} />
    </button>
  )
}

// Estado del zoom con los mismos nombres en las dos variantes.
const ESTADO_VACIO = { escala: 1, escalaEncuadre: 1, escalaMax: 3, x: 0, y: 0 }
const desdeZoomPanPinch = (e) => (e ? { escala: e.s, escalaEncuadre: e.fit, escalaMax: e.max, x: e.x, y: e.y } : ESTADO_VACIO)

export default function MarcoPlanoClaro({
  variante = "amplia",
  logo = null,
  selectorFecha = null,
  selectorPersonas = null, // slot del header, después de la fecha (pill de personas de la landing)
  tipo = null,
  onTipo,
  emojiCarpa,
  emojiSombrilla,
  chipsDeshabilitados = false, // chips visibles pero sin click (pasos sin mapa)
  onCerrar,
  tituloCerrar = "Cerrar pantalla completa",
  onRefrescar, // botón ↻ en el header; sin callback no se muestra
  refrescando = false, // ícono girando y botón deshabilitado
  tituloRefrescar = "Actualizar disponibilidad",
  barra = null, // slot entre el header y el cuerpo (ej. "Paso X de 6" + progreso)
  cuerpo = "mapa", // "mapa": children = <PlanoClaro/> con zoom; "libre": cualquier contenido, con scroll interno
  claseCuerpo = "", // clases extra para la card del cuerpo (ej. un borde si la hoja es blanca)
  leyenda = null, // slot a la derecha de "Pasillo A · B · C" (referencias de colores de la landing)
  aviso = null, // slot absoluto arriba del cuerpo (toasts del paso); lo posiciona quien lo pasa
  pie = null, // slot del footer fijo, debajo del cuerpo
  pieRef, // ref o callback ref del nodo del footer (para dibujar ahí por portal)
  rotado = false,
  onRotar,
  cargando = false,
  encuadre, // amplia: resultado de usePlanoEncuadre(); sin él, el marco usa uno propio
  mapaRef, // API del mapa: { acercar, alejar, encuadrar, acercarEn(clientX, clientY, factor), estado() }
  onCambioZoom, // ({ escala, escalaEncuadre, escalaMax, x, y }) al quedarse quieto el zoom
  resetKey, // compacta: al cambiar, ZoomPanPinch vuelve a encuadrar
  slideRef, // nodo para la animación de cambio de fecha
  onAnimationEnd,
  children, // el cuerpo
}) {
  const mapaCompacto = useRef(null)
  // Si quien lo usa no trae su encuadre, el marco usa uno propio (la landing no
  // necesita importar el hook). Con `encuadre` por props este queda sin nodos y
  // no hace nada.
  const encuadrePropio = usePlanoEncuadre({ isMobile: false, remedir: `${variante}|${cuerpo}|${cargando}` })
  const enc = encuadre || encuadrePropio
  const esMapa = cuerpo === "mapa"

  const onCambioZoomRef = useRef(onCambioZoom)
  useEffect(() => { onCambioZoomRef.current = onCambioZoom }, [onCambioZoom])

  const estadoAmplia = () => ({ escala: enc.transform.scale, escalaEncuadre: enc.fitScale, escalaMax: enc.escalaMax, x: enc.transform.x, y: enc.transform.y })

  useImperativeHandle(mapaRef, () => (
    variante === "compacta"
      ? {
          acercar: () => mapaCompacto.current?.acercar(),
          alejar: () => mapaCompacto.current?.alejar(),
          encuadrar: () => mapaCompacto.current?.encuadrar(),
          acercarEn: (clientX, clientY, factor) => mapaCompacto.current?.acercarEn(clientX, clientY, factor),
          estado: () => desdeZoomPanPinch(mapaCompacto.current?.estado()),
        }
      : {
          acercar: enc.handleZoomIn,
          alejar: enc.handleZoomOut,
          encuadrar: enc.handleEncuadrar,
          acercarEn: enc.acercarEn,
          estado: estadoAmplia,
        }
  ))

  // Amplia: el transform es estado de React, se avisa en cada cambio ya asentado.
  const { scale: escalaAmplia, x: xAmplia, y: yAmplia } = enc.transform
  useEffect(() => {
    if (variante !== "amplia" || !esMapa || !enc.ready) return
    onCambioZoomRef.current?.({ escala: escalaAmplia, escalaEncuadre: enc.fitScale, escalaMax: enc.escalaMax, x: xAmplia, y: yAmplia })
  }, [variante, esMapa, enc.ready, enc.fitScale, enc.escalaMax, escalaAmplia, xAmplia, yAmplia])

  const chips = <ChipsTipo valor={tipo} onChange={onTipo} emojiCarpa={emojiCarpa} emojiSombrilla={emojiSombrilla} deshabilitados={chipsDeshabilitados} />
  const cargandoTexto = <div className={`flex-1 flex items-center justify-center text-[13px] leading-[18px] font-medium ${TEXTO_SECUNDARIO}`}>Cargando plano…</div>
  const refrescar = (className) => onRefrescar && (
    <BotonRefrescar onRefrescar={onRefrescar} refrescando={refrescando} titulo={tituloRefrescar} className={className} />
  )
  const piePagina = (pie != null || pieRef) && (
    <div
      ref={pieRef}
      data-pie-marco
      className="shrink-0 h-16 flex items-center px-1 border-t border-[#EDEDED] dark:border-[rgb(var(--border)_/_var(--border-a))]"
    >
      {pie}
    </div>
  )
  const cuerpoLibre = (
    <section data-card-compacta data-cuerpo-marco className={`${CARD} flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col ${claseCuerpo}`}>
      {aviso}
      <div data-scroll-cuerpo className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </section>
  )

  if (variante === "compacta") {
    return (
      <div data-marco-plano className="plano-mobile-root flex-1 min-h-0 flex flex-col gap-3">
        <div className="plano-mobile-controles scroll-x-snap shrink-0 flex items-center gap-2 overflow-x-auto [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:[scroll-snap-align:start]">
          {selectorFecha}
          {selectorPersonas}
          {chips}
          {refrescar("")}
        </div>
        {barra}
        {!esMapa ? cuerpoLibre : (
          <section data-card-compacta data-cuerpo-marco className={`${CARD} flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col p-3 gap-3${claseCuerpo ? ` ${claseCuerpo}` : ""}`}>
            {aviso}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <RotuloPasillos iconSize={14} />
              {leyenda}
            </div>
            {cargando ? cargandoTexto : (
              <div className="flex-1 min-h-0 relative flex flex-col">
                <div className={`${HOJA} flex-1 min-h-0 flex flex-col`}>
                  <ZoomPanPinch
                    ref={mapaCompacto}
                    resetKey={resetKey}
                    slideRef={slideRef}
                    onAnimationEnd={onAnimationEnd}
                    onCambio={onCambioZoom ? (e) => onCambioZoomRef.current?.(desdeZoomPanPinch(e)) : undefined}
                  >
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
        )}
        {piePagina}
      </div>
    )
  }

  // Un solo nodo para el viewport del zoom y la animación de cambio de fecha.
  const setViewport = (node) => {
    enc.setViewport(node)
    if (slideRef) slideRef.current = node
  }

  return (
    <div data-marco-plano className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div data-card-compacta className={`${CARD} p-3 shrink-0`}>
        <div className="flex items-center gap-4">
          {logo}
          {selectorFecha}
          {selectorPersonas}
          {chips}
          {refrescar("ml-auto ")}
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              title={tituloCerrar}
              aria-label={tituloCerrar}
              className={`${onRefrescar ? "" : "ml-auto "}${BOTON_REDONDO}`}
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {barra}

      {!esMapa ? cuerpoLibre : (
        <div className="flex-1 min-h-0 flex gap-3">
          <section data-card-compacta data-cuerpo-marco className={`${CARD} flex-1 relative overflow-hidden flex flex-col p-3 gap-3${claseCuerpo ? ` ${claseCuerpo}` : ""}`}>
            {aviso}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <RotuloPasillos iconSize={16} />
              <div className="flex items-center gap-3 shrink-0">{leyenda}</div>
            </div>
            {cargando ? cargandoTexto : (
              <div className="flex-1 min-h-0 flex gap-3">
                {/* PlanoViewport trae su propia barra de zoom flotante (primer div): se oculta y la
                    reemplaza la columna de al lado, en el flujo del layout. */}
                <div className={`${HOJA} flex-1 min-h-0 flex flex-col relative [&>div:first-child]:hidden`}>
                  <PlanoViewport
                    transform={enc.transform}
                    ready={enc.ready}
                    isDragging={enc.isDragging}
                    canPan={enc.canPan}
                    onZoomIn={enc.handleZoomIn}
                    onZoomOut={enc.handleZoomOut}
                    onEncuadrar={enc.handleEncuadrar}
                    onTouchStart={enc.handleTouchStart}
                    onTouchMove={enc.handleTouchMove}
                    onTouchEnd={enc.handleTouchEnd}
                    onMapMouseDown={enc.handleMapMouseDown}
                    onMapWheel={enc.handleMapWheel}
                    onAnimationEnd={onAnimationEnd}
                    viewportRef={setViewport}
                    contentRef={enc.contentRef}
                  >
                    {children}
                  </PlanoViewport>
                </div>
                <BarraZoomPlano
                  onZoomIn={enc.handleZoomIn}
                  onZoomOut={enc.handleZoomOut}
                  onEncuadrar={enc.handleEncuadrar}
                  onRotar={onRotar}
                  rotado={rotado}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {piePagina}
    </div>
  )
}

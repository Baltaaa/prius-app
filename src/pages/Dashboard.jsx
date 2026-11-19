import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useArranquePantalla } from "../context/ArranqueProvider"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabase"
import { Expand, Layers } from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnidadPreviewModal from "../components/dashboard/UnidadPreviewModal"
import UnidadDetallePanel from "../components/dashboard/UnidadDetallePanel"
import PlanoMobile from "../components/dashboard/PlanoMobile"
import AsignarUnidadModal from "../components/dashboard/AsignarUnidadModal"
import MoverUnidadDialog from "../components/dashboard/MoverUnidadDialog"
import Cell from "../components/dashboard/Cell"
import CellMobile from "../components/dashboard/CellMobile"
import PlanoImpresion from "../components/dashboard/PlanoImpresion"
import PlanoImpresionCliente from "../components/dashboard/PlanoImpresionCliente"
import { imprimirDocumento } from "../lib/imprimirDocumento"
import PlanoGrid from "../components/plano/PlanoGrid"
import PlanoRotable from "../components/plano/PlanoRotable"
import PlanoClaro from "../components/plano/PlanoClaro"
import CeldaClara from "../components/plano/CeldaClara"
import MarcoPlanoClaro from "../components/plano/MarcoPlanoClaro"
import usePlanoEncuadre from "../components/plano/usePlanoEncuadre"
import { BarraZoomPlano } from "../components/plano/ControlesZoomPlano"
import { unidadEmoji } from "../lib/unidadIcono"
import PlanoViewport from "../components/plano/PlanoViewport"
import { PlanoControles, PlanoNavegadorFecha, PlanoStatTiles } from "../components/dashboard/PlanoFiltros"
import ToolbarSticky from "../components/brand/ToolbarSticky"
import { useData } from "../context/DataProvider"
import { calcularPlanoStats } from "../lib/planoStats"
import { buildUnitsMap } from "../lib/planoUnits"
import DateInput from "../components/inputs/DateInput"
import { useDeepLinkTarget } from "../hooks/useDeepLinkTarget"
import { useOverlay } from "../context/OverlayProvider"
import { useClima } from "../hooks/useClima"
import { useInitialLoad } from "../hooks/useInitialLoad"
import Skeleton from "../components/ui/Skeleton"
import { hoyAR, sumarDias } from "../lib/fechas"

// El plano de playa solo dibuja carpas y sombrillas. Cabinas y lockers están
// dentro del complejo y se manejan en su propia sección del CRM.
const PREFIJO = { carpa: "C", sombrilla: "S" }

const todayStr = hoyAR

// Mismo helper que Caja.jsx: suma/resta un día a una fecha yyyy-mm-dd sin
// líos de timezone.
const shiftDate = sumarDias

export default function Dashboard() {
  const { unidades, reservas, loading, temporadaActiva, cajaHoy, historialCajas, pagos, realtimeConectado } = useData()
  // B2 (oct 2026): `loading` es el flag global del DataProvider (compartido
  // por toda la app) — este hook solo decide cuándo mostrar el skeleton de
  // ESTA pantalla la primera vez; si el usuario ya navegó por otra pantalla
  // antes, `loading` ya viene en false y acá ni se nota.
  const readyPlano = useInitialLoad(loading)
  // El loader del arranque espera a esta pantalla (ver ArranqueProvider).
  useArranquePantalla(readyPlano)

  // Se guarda el ID, no una copia de `units[...]`: así el modal de preview
  // sigue leyendo el objeto vivo del useMemo de abajo en cada render y se
  // actualiza solo si la reserva cambia por Realtime mientras está abierto
  // (ver CLAUDE.md "Modal de unidad en el Plano").
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [asignarUnit, setAsignarUnit] = useState(null) // unidad libre a asignar, o null
  const [moverTarget, setMoverTarget] = useState(null) // { reserva, unit } a mover, o null

  // Modal de pantalla completa del plano (90% del viewport en desktop, 100%
  // en mobile) — reusa el mismo `zoom`/`selectedDate`/etc. del Dashboard, así
  // que abrir/cerrar no pierde ningún estado. Un solo árbol de ~184 <Cell>
  // montado a la vez (nunca los dos juntos) para no duplicar el ref de
  // `mapSlideRef` ni el trabajo de render.
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  // Pantalla completa = MODO CLIENTE (se le muestra el plano al cliente): sin stats, sin
  // referencias, sin imprimir y sin ficha de unidad; todas las ocupadas del mismo color.
  // Rotar: gira el plano 180° (ver PlanoRotable); el estado vive acá para que sea el mismo
  // en la vista normal y en pantalla completa.
  const [rotado, setRotado] = useState(false)
  const alternarRotar = () => setRotado((v) => !v)
  const { bind: bindFullscreen } = useOverlay({
    id: "plano-fullscreen",
    isOpen: fullscreenOpen,
    onRequestClose: () => setFullscreenOpen(false),
  })
  useEffect(() => {
    if (fullscreenOpen) setSelectedUnitId(null) // al entrar al modo cliente no queda ninguna ficha abierta
  }, [fullscreenOpen])
  useEffect(() => {
    if (!fullscreenOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [fullscreenOpen])

  // Mismo breakpoint que el resto del shell (BottomNav/Sidebar, 768px) — por
  // debajo de eso se monta PlanoMobile.jsx (componente nuevo y separado del
  // layout desktop/tablet de acá, ver rediseño oct 2026) en vez del body de
  // franja superior + panel lateral. Declarado ANTES de `computeFit` (abajo),
  // que lo lee para decidir si auto-encuadra (desktop) o arranca siempre a
  // escala 1 (mobile, ver ese comentario).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mql.matches)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Zoom, encuadre y arrastre del mapa en desktop/tablet: usePlanoEncuadre
  // (carpeta portable, Fase 6A: el mismo hook lo usa la landing). Un solo estado
  // para la vista normal y la vista clientes, así abrir/cerrar pantalla completa
  // no lo pierde. `remedir`: el nodo real del viewport cambia con la pantalla
  // completa y recién existe cuando termina el loading y el skeleton
  // (`readyPlano`, ver useInitialLoad): sin volver a medir ahí el plano quedaba
  // invisible al navegar desde otra pantalla con los datos ya en caché.
  const encuadre = usePlanoEncuadre({ isMobile, remedir: `${fullscreenOpen}|${loading}|${readyPlano}` })
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const esHoy = selectedDate === todayStr()

  // Deslizamiento del mapa al cambiar de fecha: animación por clase CSS sobre
  // un wrapper (ver index.css), nunca por `key` — un `key` en un ancestro de
  // las ~184 Cell forzaría un remount completo y ahí sí habría lag.
  const mapSlideRef = useRef(null)
  const mapSlideTimeoutRef = useRef(null)
  const slideMap = (direction) => {
    const el = mapSlideRef.current
    if (!el) return
    const cls = direction === "forward" ? "plano-slide-left" : "plano-slide-right"
    el.classList.remove("plano-slide-left", "plano-slide-right")
    void el.offsetWidth // fuerza reflow para poder re-disparar la misma animación en clicks seguidos
    el.classList.add(cls)
    // Fallback además de onAnimationEnd: en una pestaña sin foco (o con
    // "prefers-reduced-motion") el evento animationend puede no llegar a
    // tiempo — igual hay que soltar la clase para no dejarla pegada.
    clearTimeout(mapSlideTimeoutRef.current)
    mapSlideTimeoutRef.current = setTimeout(() => el.classList.remove("plano-slide-left", "plano-slide-right"), 250)
  }
  const goToDate = (newDate) => {
    if (newDate === selectedDate) return
    slideMap(newDate > selectedDate ? "forward" : "backward")
    setSelectedDate(newDate)
  }

  // El estado de cada unidad lo escribe el trigger de Postgres al vencer/crear
  // reservas, y el pg_cron nocturno libera las que vencieron sin actividad.
  // Al abrir el plano forzamos ese recálculo para no depender del cron.
  useEffect(() => {
    supabase.rpc("fn_recalcular_estados_unidades").then(({ error }) => {
      if (error) console.error("No se pudo recalcular estados del plano:", error.message)
    })
  }, [])

  // Mapa de unidades con estado derivado para `selectedDate` — extraído a
  // `lib/planoUnits.js` (oct 2026) para que el Dashboard real
  // (`pages/crm/Home.jsx`) calcule sus KPIs de ocupación con el mismo
  // criterio exacto, sin duplicar la regla. Mismo resultado que antes.
  const units = useMemo(
    () => buildUnitsMap(unidades, reservas, selectedDate),
    [unidades, reservas, selectedDate],
  )

  // Impresión para el CLIENTE (nov 2026): hoja de disponibilidad Libre /
  // Ocupado de la fecha elegida, en su propio iframe. Es otra impresión: la
  // hoja A4 de los carperos (PlanoImpresion + window.print()) no se toca.
  const imprimirPlanoCliente = useCallback(() => {
    imprimirDocumento(
      <PlanoImpresionCliente units={units} fecha={selectedDate} />,
      { titulo: `Prius - plano de disponibilidad ${selectedDate}` },
    )
  }, [units, selectedDate])

  // Caja de la fecha elegida (no siempre "hoy"): `cajaHoy` solo cubre el día
  // de hoy, `historialCajas` trae las últimas 30 por fecha — entre las dos
  // alcanza para el chip de "Ingresos del día" sin ninguna query nueva. Si
  // la fecha no está en ninguna de las dos, `calcularPlanoStats` ya resuelve
  // "—" (ver `lib/planoStats.js`).
  const cajaDelDia = useMemo(
    () => (selectedDate === todayStr() ? cajaHoy : (historialCajas.find((c) => c.fecha === selectedDate) || null)),
    [cajaHoy, historialCajas, selectedDate],
  )

  const planoStats = useMemo(
    () => calcularPlanoStats({ units, pagos, reservas, cajaDelDia, selectedDate }),
    [units, pagos, reservas, cajaDelDia, selectedDate],
  )

  // Mismo hook que usa PlanoStatsBar — el cache de `useClima` es por fecha a
  // nivel módulo, así que esta segunda llamada (para la hoja A4) no dispara
  // un fetch extra salvo que todavía no se haya pedido esa fecha.
  const { clima: climaDelDia } = useClima(selectedDate)

  // Filtros visuales del Plano: las stats son el filtro de ESTADO (Todas /
  // Ocupadas / Libres / Pendientes) y un segmented es el de TIPO (Todo /
  // Carpas / Sombrillas). Se combinan: se resaltan las unidades que cumplen
  // los dos. Puramente de presentación — no toca ningún dato, solo decide
  // `isHighlighted`/`isDimmed` en cada <Cell>.
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [tipoFiltro, setTipoFiltro] = useState(null)
  const toggleEstadoFiltro = useCallback((key) => {
    setEstadoFiltro((prev) => (prev === key ? null : key))
  }, [])
  // En modo cliente el filtro de estado (que dejaría "pendientes" a la vista) no se aplica.
  const estadoEfectivo = fullscreenOpen ? null : estadoFiltro
  const highlightedUnitIds = useMemo(() => {
    if (!estadoEfectivo && !tipoFiltro) return null
    const porEstado = {
      ocupacion: planoStats.ocupacion.unitIds,
      libres: planoStats.libres.unitIds,
      pendientes: planoStats.pendientes.unitIds,
    }
    const todas = Object.values(units)
    const porTipo = {
      carpas: todas.filter((u) => u.type === 'carpa').map((u) => u.dbId),
      sombrillas: todas.filter((u) => u.type === 'sombrilla').map((u) => u.dbId),
    }
    const conjuntos = [estadoEfectivo && porEstado[estadoEfectivo], tipoFiltro && porTipo[tipoFiltro]].filter(Boolean)
    const [primero, ...resto] = conjuntos
    return new Set(primero.filter((id) => resto.every((c) => c.includes(id))))
  }, [estadoEfectivo, tipoFiltro, planoStats, units])
  const cellHighlight = useCallback((unit) => {
    if (!highlightedUnitIds || !unit) return {}
    return highlightedUnitIds.has(unit.dbId) ? { isHighlighted: true } : { isDimmed: true }
  }, [highlightedUnitIds])

  const selectedUnit = selectedUnitId ? units[selectedUnitId] : null

  // Handlers compartidos entre el panel lateral fijo (desktop, ≥1024px) y la
  // hoja inferior (tablet/mobile) — una sola definición, los dos consumen
  // exactamente los mismos.
  const handleCerrarDetalle = () => setSelectedUnitId(null)
  const handleAsignarTemporada = (unit) => { setSelectedUnitId(null); setAsignarUnit(unit) }
  const handleMoverUnidadClick = (reserva, unit) => { setSelectedUnitId(null); setMoverTarget({ reserva, unit }) }


  // Deep-link vía linkToPlano() (Tarea 1, oct 2026): mueve el plano a la
  // fecha pedida y resalta la unidad referida (ej. desde Notificaciones o
  // el día de un mes en Ocupación). `unidades`/`reservas` ya están en
  // memoria por el DataProvider -> `!loading` alcanza como señal de "listo".
  useDeepLinkTarget({
    params: ['fecha', 'unidad'],
    ready: !loading,
    resolve: ({ fecha, unidad }) => {
      if (fecha) setSelectedDate(fecha)
      if (!unidad) return true
      const match = Object.values(units).find((u) => u.dbId === unidad)
      if (!match) return null
      setSelectedUnitId(match.id)
      return unidad
    },
  })

  // Unidades libres AHORA (sin reserva de temporada vigente) — destino
  // posible para "Mover a otra unidad" (ítem 5).
  const unidadesLibres = useMemo(
    () => Object.values(units).filter((u) => u.status === STATUS.LIBRE).map((u) => ({ id: u.dbId, tipo: u.type, numero: u.number })),
    [units],
  )

  // useCallback: referencia estable para no romper el React.memo de las 184 Cell
  const handleUnitClick = useCallback((unit) => {
    if (unit) setSelectedUnitId(unit.id)
  }, [])

  // Puente entre PlanoGrid (portable, no sabe nada de reservas) y Cell
  // (CRM): recibe el slot que arma PlanoGrid ({numero, tipo, numberSide, ...}
  // desde planoLayout.js, más los campos de la fila cruda de `unidades` si
  // existe) y busca la versión enriquecida con estado/reserva en `units`
  // para pasársela a <Cell>, igual que hacían getCarpa/getSombrilla antes.
  const renderCelda = useCallback((slot) => {
    const prefijo = PREFIJO[slot.tipo]
    const unit = prefijo ? units[`${prefijo}${slot.numero}`] : null
    return (
      <Cell
        key={`${slot.tipo}-${slot.numero}`}
        number={slot.numero}
        unit={unit}
        onClick={handleUnitClick}
        numberSide={slot.numberSide}
        {...cellHighlight(unit)}
      />
    )
  }, [units, handleUnitClick, cellHighlight])

  // Misma unidad/handlers que renderCelda, pero con CellMobile (celda nueva
  // y separada, ver ese archivo) — nunca Cell.jsx escalado. Mismo puente,
  // mismo PlanoGrid congelado, solo cambia qué componente dibuja cada celda.
  const renderCeldaMobile = useCallback((slot) => {
    const prefijo = PREFIJO[slot.tipo]
    const unit = prefijo ? units[`${prefijo}${slot.numero}`] : null
    return (
      <CellMobile
        key={`${slot.tipo}-${slot.numero}`}
        number={slot.numero}
        unit={unit}
        onClick={handleUnitClick}
        {...cellHighlight(unit)}
      />
    )
  }, [units, handleUnitClick, cellHighlight])

  // Vista clientes (pantalla completa, Fase 6A): CeldaClara, la misma casilla
  // que usa la landing. Solo libre / ocupada (todo lo que no es libre, incluida
  // la pendiente de confirmación): nada que distinga saldo, tipo de alquiler ni
  // titular, y tocarla no abre nada. Los chips de tipo atenúan lo que no
  // corresponde y marcan con el aro lo que sí.
  const renderCeldaCliente = useCallback((slot) => {
    const prefijo = PREFIJO[slot.tipo]
    const unit = prefijo ? units[`${prefijo}${slot.numero}`] : null
    const filtro = cellHighlight(unit)
    return (
      <CeldaClara
        key={`${slot.tipo}-${slot.numero}`}
        numero={slot.numero}
        estado={unit && unit.status !== STATUS.LIBRE ? "ocupada" : "libre"}
        tamano={isMobile ? "tactil" : "compacta"}
        numberSide={slot.numberSide}
        resaltada={!!filtro.isHighlighted}
        deshabilitada={!!filtro.isDimmed}
        data-deeplink-id={unit?.dbId}
      />
    )
  }, [units, cellHighlight, isMobile])

  // Un solo nodo cumple el doble rol de "ref de la animación de slide al
  // cambiar de fecha" y "ref del viewport para medir el encuadre" — nunca dos
  // elementos distintos, porque solo hay UNO montado a la vez (ver abajo).
  const setMapViewportRef = (node) => { mapSlideRef.current = node; encuadre.viewportRef.current = node }
  const quitarSlide = (e) => e.currentTarget.classList.remove("plano-slide-left", "plano-slide-right")

  const renderPlanoBody = (fullscreen) => {
    const diaSemana = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '')

    // Vista clientes (pantalla completa): el marco y el cuerpo portables de
    // src/components/plano (MarcoPlanoClaro + PlanoClaro + CeldaClara), los
    // mismos que copia la landing. Acá solo se les pasan los datos del CRM.
    if (fullscreen) {
      return (
        <MarcoPlanoClaro
          variante={isMobile ? "compacta" : "amplia"}
          logo={<img src="/images/prius-icon.png" alt="Prius" className="w-11 h-11 object-contain shrink-0" />}
          selectorFecha={(
            <PlanoNavegadorFecha
              selectedDate={selectedDate}
              esHoy={esHoy}
              diaSemana={isMobile ? undefined : diaSemana}
              onPrevDay={() => goToDate(shiftDate(selectedDate, -1))}
              onNextDay={() => goToDate(shiftDate(selectedDate, 1))}
              onHoy={() => goToDate(todayStr())}
              onDateChange={goToDate}
              compacto={isMobile}
            />
          )}
          tipo={tipoFiltro}
          onTipo={setTipoFiltro}
          emojiCarpa={unidadEmoji("carpa")}
          emojiSombrilla={unidadEmoji("sombrilla")}
          onCerrar={() => setFullscreenOpen(false)}
          rotado={rotado}
          onRotar={alternarRotar}
          cargando={loading}
          encuadre={encuadre}
          resetKey={`${estadoFiltro ?? ""}|${tipoFiltro ?? ""}`}
          slideRef={mapSlideRef}
          onAnimationEnd={quitarSlide}
        >
          <PlanoClaro unidades={unidades} renderCelda={renderCeldaCliente} rotado={rotado} />
        </MarcoPlanoClaro>
      )
    }

    // Mobile (<768px): componente nuevo y separado (mock 02-plano-mobile) —
    // nunca comparte JSX con el layout desktop/tablet de acá abajo, solo los
    // mismos datos/handlers ya calculados en este componente.
    if (isMobile) {
      return (
        <PlanoMobile
          selectedDate={selectedDate}
          esHoy={esHoy}
          onPrevDay={() => goToDate(shiftDate(selectedDate, -1))}
          onNextDay={() => goToDate(shiftDate(selectedDate, 1))}
          onHoy={() => goToDate(todayStr())}
          onDateChange={goToDate}
          planoStats={planoStats}
          loading={loading}
          estadoFiltro={estadoFiltro}
          onEstado={toggleEstadoFiltro}
          tipoFiltro={tipoFiltro}
          onTipo={setTipoFiltro}
          onImprimir={() => window.print()}
          onImprimirCliente={imprimirPlanoCliente}
          rotado={rotado}
          onRotar={alternarRotar}
          onAbrirVistaClientes={() => setFullscreenOpen(true)}
          slideRef={mapSlideRef}
          onAnimationEnd={quitarSlide}
          unidades={unidades}
          renderCelda={renderCeldaMobile}
        />
      )
    }

    // Desktop/tablet (≥768px, mock 02-plano-desktop / 02-plano-tablet):
    // misma franja superior para los dos, grilla de KPIs/filtros responsive
    // (flex en desktop, grid-cols-3 + scroll-x en tablet vía Tailwind). El
    // panel lateral fijo (UnidadDetallePanel) solo se ve en ≥1024px —
    // tablet sigue usando la hoja inferior (UnidadPreviewModal) para el
    // detalle, como pide la tarea.
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2.5">
        {/* Controles (fecha, tipo, Referencias, impresiones): viven en la
            barra única de la página (ToolbarSticky -> PageTopbar). Los tiles
            de stats, que SON los filtros de estado, siguen en su card. */}
        <ToolbarSticky>
          <PlanoControles
            selectedDate={selectedDate}
            esHoy={esHoy}
            diaSemana={diaSemana}
            onPrevDay={() => goToDate(shiftDate(selectedDate, -1))}
            onNextDay={() => goToDate(shiftDate(selectedDate, 1))}
            onHoy={() => goToDate(todayStr())}
            onDateChange={goToDate}
            tipoFiltro={tipoFiltro}
            onTipo={setTipoFiltro}
            onImprimir={() => window.print()}
            onImprimirCliente={imprimirPlanoCliente}
          />
        </ToolbarSticky>
        <div data-card-compacta className="card-surface p-3 shrink-0">
          <PlanoStatTiles
            stats={planoStats}
            valor={estadoFiltro}
            onChange={toggleEstadoFiltro}
            fecha={selectedDate}
          />
        </div>

        {/* Workspace: grid (sin tocar) + panel lateral fijo (desktop) */}
        <div className="flex-1 min-h-0 flex gap-3">
          <section data-card-compacta className="card-surface flex-1 relative overflow-hidden flex flex-col p-3 gap-3">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <span className="flex items-center gap-2 text-ink-2 min-w-0">
                <Layers size={16} className="shrink-0" />
                <span className="text-label truncate">Pasillo A · B · C</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {realtimeConectado && (
                  <span className="hidden md:inline-flex lg:hidden xl:inline-flex items-center gap-2 bg-surface px-3 h-7 rounded-full text-ink-2">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-label">{planoStats?.ocupacion.total || 0} unidades sincronizadas</span>
                  </span>
                )}
              </div>
            </div>
            {loading ? (
              <div className="text-label flex-1 flex items-center justify-center text-ink-2">
                Cargando plano…
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex gap-3">
                {/* `[&>div:first-child]:hidden` oculta la barra de zoom propia
                    de PlanoViewport.jsx (vive adentro con position:absolute
                    encima del mapa) — BarraZoomPlano la reemplaza acá al lado,
                    fuera del mapa, llamando a las mismas funciones. */}
                {/* Hoja del mapa: sigue el tema activo de la app (nov 2026). La
                    impresión A4 del plano no cambia: la hace PlanoImpresion.jsx,
                    aparte y en blanco. */}
                <div className="plano-hoja flex-1 min-h-0 flex flex-col relative [&>div:first-child]:hidden">
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
                    onAnimationEnd={quitarSlide}
                    viewportRef={setMapViewportRef}
                    contentRef={encuadre.contentRef}
                  >
                    <PlanoRotable rotado={rotado}>
                      <PlanoGrid unidades={unidades} renderCelda={renderCelda} />
                    </PlanoRotable>
                  </PlanoViewport>
                </div>
                <BarraZoomPlano
                  onZoomIn={encuadre.handleZoomIn}
                  onZoomOut={encuadre.handleZoomOut}
                  onEncuadrar={encuadre.handleEncuadrar}
                  onRotar={alternarRotar}
                  rotado={rotado}
                  extraButtons={(
                    <button onClick={() => setFullscreenOpen(true)} className="w-11 h-11 md:w-9 md:h-9 rounded-full bg-surface hover:bg-surface text-ink flex items-center justify-center transition-colors" title="Ver en pantalla completa">
                      <Expand size={16} />
                    </button>
                  )}
                />
              </div>
            )}
          </section>

          <UnidadDetallePanel
            unit={selectedUnit}
            reservas={reservas}
            temporadaActiva={temporadaActiva}
            onClose={handleCerrarDetalle}
            onAsignarTemporada={handleAsignarTemporada}
            onMoverUnidad={handleMoverUnidadClick}
          />
        </div>
      </div>
    )
  }

  if (!readyPlano) {
    return (
      <div className="h-full flex flex-col overflow-hidden p-4 gap-4">
        <Skeleton className="h-24 shrink-0" />
        <div className="flex-1 flex gap-4 min-h-0">
          <Skeleton className="flex-1" />
          <Skeleton className="hidden lg:block w-96 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col animate-premium-fade overflow-hidden">
    <div className="no-print flex-1 flex flex-col space-y-4 overflow-hidden pb-4">
      {!fullscreenOpen && renderPlanoBody(false)}

      {fullscreenOpen && createPortal(
        <div
          className="fixed inset-0 z-[999] bg-overlay backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setFullscreenOpen(false)}
        >
          <div
            ref={bindFullscreen}
            onClick={(e) => e.stopPropagation()}
            data-card-compacta className="card-surface plano-fullscreen-sheet w-full h-dvh rounded-none md:w-[90vw] md:h-[90dvh] md:rounded-card overflow-hidden flex flex-col space-y-4 p-4 sm:p-6 animate-in zoom-in-95 duration-200"
          >
            {renderPlanoBody(true)}
          </div>
        </div>,
        document.body,
      )}

      {selectedUnit && !fullscreenOpen && (
        <UnidadPreviewModal
          unit={selectedUnit}
          reservas={reservas}
          temporadaActiva={temporadaActiva}
          onClose={handleCerrarDetalle}
          onAsignarTemporada={handleAsignarTemporada}
          onMoverUnidad={handleMoverUnidadClick}
        />
      )}

      <AsignarUnidadModal
        isOpen={!!asignarUnit}
        onClose={() => setAsignarUnit(null)}
        unit={asignarUnit}
        temporadaActiva={temporadaActiva}
      />

      <MoverUnidadDialog
        isOpen={!!moverTarget}
        onClose={() => setMoverTarget(null)}
        reserva={moverTarget?.reserva}
        unidadOrigen={moverTarget?.unit}
        unidadesLibres={unidadesLibres}
      />
    </div>

    {/* Hoja A4 de impresión: oculta en pantalla, única cosa visible al imprimir. */}
    {/* clima ya no se imprime (Tarea 4, oct 2026: cero datos que no sean del plano físico) — climaDelDia sigue viva para PlanoStatsBar en pantalla. */}
    {!loading && <PlanoImpresion units={units} selectedDate={selectedDate} stats={planoStats} />}

      <style>{`
        /* Pantalla completa del plano en mobile (<768px, donde el modal es
           inset-0 y 100dvh, sin radio ni margen): reserva las safe areas del
           dispositivo (notch arriba, home indicator abajo) sumadas al
           padding de siempre (p-4), para que los botones de zoom y el de
           salir nunca queden debajo de ellas. Desktop (md:, >=768px) no se
           toca — ahí el modal ya no llega a los bordes reales de pantalla. */
        @media (max-width: 767.98px) {
          .plano-fullscreen-sheet {
            padding-top: calc(1rem + env(safe-area-inset-top));
            padding-right: calc(1rem + env(safe-area-inset-right));
            padding-bottom: calc(1rem + env(safe-area-inset-bottom));
            padding-left: calc(1rem + env(safe-area-inset-left));
          }
        }

        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
        .overflow-auto::-webkit-scrollbar { width: 8px; height: 8px; }
        .overflow-auto::-webkit-scrollbar-track { background: transparent; }
        .overflow-auto::-webkit-scrollbar-thumb { background: rgb(var(--primary) / 0.15); border-radius: 4px; }
        .overflow-auto::-webkit-scrollbar-thumb:hover { background: rgb(var(--accent)); }
      `}</style>
    </div>
  )
}

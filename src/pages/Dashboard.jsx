import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabase"
import { Printer, Expand, Shrink, ChevronLeft, ChevronRight } from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnidadPreviewModal from "../components/dashboard/UnidadPreviewModal"
import AsignarUnidadModal from "../components/dashboard/AsignarUnidadModal"
import MoverUnidadDialog from "../components/dashboard/MoverUnidadDialog"
import Cell from "../components/dashboard/Cell"
import PlanoImpresion from "../components/dashboard/PlanoImpresion"
import PlanoGrid from "../components/plano/PlanoGrid"
import PlanoViewport from "../components/plano/PlanoViewport"
import PlanoStatsBar, {
  OcupacionCard, CarpasCard, SombrillasCard, LibresCard, MixCard, PendientesCard, IngresosCard, ClimaCard, EstadoLegend,
} from "../components/dashboard/PlanoStatsBar"
import { useData } from "../context/DataProvider"
import { coSocios, reservaActiva } from "../lib/reservas"
import { calcularPlanoStats } from "../lib/planoStats"
import DateInput from "../components/inputs/DateInput"
import { useDeepLinkTarget } from "../hooks/useDeepLinkTarget"
import { useOverlay } from "../context/OverlayProvider"
import { useClima } from "../hooks/useClima"

// El plano de playa solo dibuja carpas y sombrillas. Cabinas y lockers están
// dentro del complejo y se manejan en su propia sección del CRM.
const PREFIJO = { carpa: "C", sombrilla: "S" }

const todayStr = () => new Date().toISOString().split("T")[0]

// Mismo helper que Caja.jsx: suma/resta un día a una fecha yyyy-mm-dd sin
// líos de timezone.
const shiftDate = (fecha, delta) => {
  const d = new Date(fecha + "T00:00:00")
  d.setDate(d.getDate() + delta)
  return d.toISOString().split("T")[0]
}

export default function Dashboard() {
  const { unidades, reservas, loading, temporadaActiva, cajaHoy, historialCajas, pagos } = useData()

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
  const { bind: bindFullscreen } = useOverlay({
    id: "plano-fullscreen",
    isOpen: fullscreenOpen,
    onRequestClose: () => setFullscreenOpen(false),
  })
  useEffect(() => {
    if (!fullscreenOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [fullscreenOpen])

  // --- Fit al contenedor (mobile y desktop, Fase 4A hotfix oct 2026) -------
  // Antes: por debajo de 768px el mapa usaba un modo aparte (scroll nativo +
  // zoom simple por escala, sin encuadre). Bug real que eso causaba en
  // mobile: el plano nunca entraba encuadrado al abrir (quedaba más ancho
  // que la pantalla, forzando scroll horizontal de TODA la página, no solo
  // del mapa) — ver CLAUDE.md "Plano portable". Ahora un solo modo para
  // cualquier tamaño: fit-to-container con zoom relativo al punto tocado/
  // clickeado y pan por drag — mouse (desktop) y touch (mobile) alimentan
  // exactamente el mismo estado `transform`, nunca dos sistemas en paralelo.
  // Bug real que esto corrige: la medición vieja corría en un `useEffect`
  // sin `loading` como dependencia, así que si el mapa todavía no existía en
  // el DOM (`loading=true` muestra "Cargando plano…" en vez del mapa) el
  // observer nunca se enganchaba — `fitScale` se quedaba en su valor inicial
  // (1), cortando la franja de arriba (Recreación/Acceso/Pileta) y además
  // bloqueando el zoom-out (el piso del zoom ERA ese fitScale mal calculado).
  //
  // Estructura (sin flex-centering ni transform-origin center, a propósito):
  // `viewportRef` = contenedor, `overflow:hidden; position:relative`.
  // `contentRef`  = capa transformada, `position:absolute; top:0; left:0;
  // transform-origin:0 0`, con el plano en su tamaño intrínseco adentro —
  // medir su offsetWidth/offsetHeight es seguro en cualquier momento (CSS
  // transform nunca cambia el layout size del propio elemento).
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const sizesRef = useRef({ contW: 0, contH: 0, contentW: 0, contentH: 0 })
  const userInteractedRef = useRef(false) // ref (no solo state) para que el closure del ResizeObserver siempre lea el valor actual, no uno viejo capturado al montar
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startX0: 0, startY0: 0 })

  const [fitScale, setFitScale] = useState(1)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const [ready, setReady] = useState(false) // oculto hasta la primera medición válida — nunca se ve un frame cortado
  const [, setUserInteractedState] = useState(false) // solo para que el botón "Encuadrar" pueda reflejar el estado si hiciera falta
  const [isDragging, setIsDragging] = useState(false)

  const round1 = (n) => Math.round(n * 10) / 10
  const PLANO_PAD = 24
  const computeFit = (contW, contH, contentW, contentH) =>
    Math.min((contW - PLANO_PAD * 2) / contentW, (contH - PLANO_PAD * 2) / contentH)
  const centeredPos = (contW, contH, contentW, contentH, scale) => ({
    x: (contW - contentW * scale) / 2,
    y: (contH - contentH * scale) / 2,
  })
  const clampScale = (s) => Math.min(3, Math.max(fitScale * 0.5, s))
  // Si el plano escalado entra en el eje, se fuerza centrado (no hay nada
  // para desplazar ahí); si lo excede, se limita para que nunca salga
  // completamente de vista (un borde como mucho llega a pegarse al del
  // contenedor, nunca más allá).
  const clampPan = (x, y, scale) => {
    const { contW, contH, contentW, contentH } = sizesRef.current
    const scaledW = contentW * scale
    const scaledH = contentH * scale
    const cx = scaledW <= contW ? (contW - scaledW) / 2 : Math.min(0, Math.max(contW - scaledW, x))
    const cy = scaledH <= contH ? (contH - scaledH) / 2 : Math.min(0, Math.max(contH - scaledH, y))
    return { x: cx, y: cy }
  }
  const markUserInteracted = () => {
    if (userInteractedRef.current) return
    userInteractedRef.current = true
    setUserInteractedState(true)
  }

  // useLayoutEffect (no useEffect): mide y aplica el encuadre ANTES del
  // primer paint visible, así `ready` nunca llega a pintarse en falso. Vuelve
  // a correr cuando `loading` pasa a false (el mapa recién ahí existe en el
  // DOM) y cuando cambia `fullscreenOpen` (el nodo real del viewport es otro).
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const aplicarEncuadre = () => {
      const contW = viewport.clientWidth
      const contH = viewport.clientHeight
      const contentW = content.offsetWidth
      const contentH = content.offsetHeight
      if (!contW || !contH || !contentW || !contentH) return
      sizesRef.current = { contW, contH, contentW, contentH }
      const fit = computeFit(contW, contH, contentW, contentH)
      setFitScale(fit)
      if (!userInteractedRef.current) {
        setTransform({ scale: fit, ...centeredPos(contW, contH, contentW, contentH, fit) })
      }
      setReady(true)
    }

    aplicarEncuadre()
    // Observa contenedor Y contenido (fuentes/datos/unidades pueden cambiar
    // el tamaño intrínseco del plano después del primer render).
    const ro = new ResizeObserver(aplicarEncuadre)
    ro.observe(viewport)
    ro.observe(content)
    return () => ro.disconnect()
  }, [fullscreenOpen, loading])

  const handleEncuadrar = () => {
    userInteractedRef.current = false
    setUserInteractedState(false)
    const { contW, contH, contentW, contentH } = sizesRef.current
    const fit = computeFit(contW, contH, contentW, contentH)
    setFitScale(fit)
    setTransform({ scale: fit, ...centeredPos(contW, contH, contentW, contentH, fit) })
  }

  // Zoom manteniendo fijo el punto (px, py) EN COORDENADAS DEL CONTENEDOR —
  // los botones +/- usan el centro del contenedor, ctrl+rueda usa el cursor.
  const zoomAt = (px, py, targetScale) => {
    markUserInteracted()
    setTransform((prev) => {
      const scale = clampScale(targetScale)
      const contentX = (px - prev.x) / prev.scale
      const contentY = (py - prev.y) / prev.scale
      const nx = px - contentX * scale
      const ny = py - contentY * scale
      const { x, y } = clampPan(nx, ny, scale)
      return { scale, x, y }
    })
  }

  // Pan por drag del mouse — solo si el plano escalado excede el contenedor
  // en algún eje (si entero ya entra, no hay nada para desplazar). Listeners
  // en `window` (no en el propio contenedor) para seguir recibiendo
  // `mousemove` aunque el cursor salga del viewport mientras se arrastra.
  const handleMapMouseDown = (e) => {
    const { contW, contH, contentW, contentH } = sizesRef.current
    if (contentW * transform.scale <= contW && contentH * transform.scale <= contH) return
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startX0: transform.x, startY0: transform.y }
    setIsDragging(true)
  }
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setTransform((prev) => {
        const { x, y } = clampPan(dragRef.current.startX0 + dx, dragRef.current.startY0 + dy, prev.scale)
        return { ...prev, x, y }
      })
    }
    const onUp = () => {
      if (!dragRef.current.dragging) return
      dragRef.current.dragging = false
      setIsDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Ctrl+rueda para zoom (desktop/tablet), relativo a la posición del cursor
  // sobre el contenedor — sin Ctrl, la rueda no hace nada especial (el
  // contenedor no tiene scroll nativo en este modo).
  const handleMapWheel = (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const rect = viewportRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    zoomAt(px, py, round1(transform.scale + delta))
  }

  // Táctil (mobile, Fase 4A hotfix): un dedo arrastra (mismo pan por drag
  // que el mouse, con touch.clientX/Y en vez de e.clientX/Y); dos dedos
  // pinchean, con el zoom centrado en el punto medio entre los dos toques —
  // se recalcula en cada touchmove con el midpoint ACTUAL (no uno fijo al
  // empezar), así el zoom "sigue" a los dedos mientras se mueven, igual que
  // una app nativa. Reusa `zoomAt`/`clampPan`, el mismo camino que ya usan
  // los botones y Ctrl+rueda — nunca un estado de escala en paralelo.
  const touchPinchRef = useRef({ active: false, startDist: 0, startScale: 1 })
  const touchDistance = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  )
  const touchMidpoint = (touches, rect) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  })
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      touchPinchRef.current = { active: true, startDist: touchDistance(e.touches), startScale: transform.scale }
      dragRef.current.dragging = false
      setIsDragging(false)
      return
    }
    if (e.touches.length === 1) {
      const { contW, contH, contentW, contentH } = sizesRef.current
      if (contentW * transform.scale <= contW && contentH * transform.scale <= contH) return
      const t = e.touches[0]
      dragRef.current = { dragging: true, startX: t.clientX, startY: t.clientY, startX0: transform.x, startY0: transform.y }
      setIsDragging(true)
    }
  }
  const handleTouchMove = (e) => {
    if (touchPinchRef.current.active && e.touches.length === 2) {
      e.preventDefault()
      const rect = viewportRef.current.getBoundingClientRect()
      const dist = touchDistance(e.touches)
      const ratio = dist / touchPinchRef.current.startDist
      const { x, y } = touchMidpoint(e.touches, rect)
      zoomAt(x, y, round1(touchPinchRef.current.startScale * ratio))
      return
    }
    if (dragRef.current.dragging && e.touches.length === 1) {
      e.preventDefault()
      const t = e.touches[0]
      const dx = t.clientX - dragRef.current.startX
      const dy = t.clientY - dragRef.current.startY
      setTransform((prev) => {
        const { x, y } = clampPan(dragRef.current.startX0 + dx, dragRef.current.startY0 + dy, prev.scale)
        return { ...prev, x, y }
      })
    }
  }
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) touchPinchRef.current.active = false
    if (e.touches.length === 0) {
      dragRef.current.dragging = false
      setIsDragging(false)
    }
  }
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

  // Reserva vigente en `selectedDate` (hoy por defecto) por unidad. La celda
  // se pinta según su tipo_alquiler (T/P/D); si no hay reserva vigente ese
  // día, la unidad va libre. Un abonado de temporada completa cubre
  // cualquier fecha dentro de la temporada, sin importar cuál se elija.
  const reservaPorUnidad = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      if (!r.unidad_id || !reservaActiva(r)) continue
      const vigente =
        r.tipo_alquiler === "temporada" ||
        (r.tipo_alquiler === "dia" && r.fecha === selectedDate) ||
        (r.tipo_alquiler === "periodo" && r.fecha_inicio <= selectedDate && selectedDate <= r.fecha_fin)
      if (vigente) map[r.unidad_id] = r
    }
    return map
  }, [reservas, selectedDate])

  const units = useMemo(() => {
    const map = {}
    for (const u of unidades) {
      const px = PREFIJO[u.tipo]
      if (!px) continue
      const r = reservaPorUnidad[u.id]
      const status = !r
        ? STATUS.LIBRE
        : r.estado_pago === "pendiente_confirmacion"
          ? STATUS.PENDIENTE_CONFIRMACION
          : r.tipo_alquiler === "temporada"
            ? STATUS.TEMPORADA
            : r.tipo_alquiler === "dia"
              ? STATUS.DIA
              : STATUS.PERIODO
      map[`${px}${u.numero}`] = {
        id: `${px}${u.numero}`,
        dbId: u.id,
        reservaId: r?.id || null,
        number: u.numero,
        type: u.tipo,
        status,
        tipoAlquiler: r?.tipo_alquiler || null,
        clientName: r?.clientes?.nombre || "",
        clientPhone: r?.clientes?.telefono || "",
        clientEmail: r?.clientes?.mail || "",
        coSocios: r ? coSocios(r).map((c) => c.nombre) : [],
        startDate: r?.fecha_inicio || r?.fecha || "",
        endDate: r?.fecha_fin || r?.fecha || "",
        notes: r?.notas || "",
        isPaid: r?.estado_pago === "pagado",
        isTemporada: r?.tipo_alquiler === "temporada",
        // D5 (Fase 3 Recepción): reserva web preconfirmada vigente — borde
        // punteado + reloj en la celda, sin tocar los colores de tipo_alquiler.
        // `r` ya pasó por reservaActiva() en reservaPorUnidad, así que acá solo
        // hace falta distinguir el origen.
        esPreconfirmadaWeb: r?.origen === "web" && r?.preconfirmada === true,
        // Fila cruda de `reservas` (con clientes/unidades/reserva_clientes
        // embebidos por el select del DataProvider) — el preview del modal la
        // usa directo en vez de reconstruir un objeto plano a mano.
        reserva: r || null,
      }
    }
    return map
  }, [unidades, reservaPorUnidad])

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
    () => calcularPlanoStats({ units, pagos, cajaDelDia, selectedDate }),
    [units, pagos, cajaDelDia, selectedDate],
  )

  // Mismo hook que usa PlanoStatsBar — el cache de `useClima` es por fecha a
  // nivel módulo, así que esta segunda llamada (para la hoja A4) no dispara
  // un fetch extra salvo que todavía no se haya pedido esa fecha.
  const { clima: climaDelDia } = useClima(selectedDate)

  // Filtro visual de PlanoStatsBar: qué chip está "activo" ahora, y el set de
  // unidades que corresponde resaltar. Puramente de presentación — no toca
  // ningún dato, solo decide `isHighlighted`/`isDimmed` en cada <Cell>.
  const [statsFiltro, setStatsFiltro] = useState(null)
  const toggleStatsFiltro = useCallback((key) => {
    setStatsFiltro((prev) => (prev === key ? null : key))
  }, [])
  const highlightedUnitIds = useMemo(() => {
    if (!statsFiltro) return null
    const porFiltro = {
      ocupacion: planoStats.ocupacion.unitIds,
      carpas: planoStats.carpas.unitIds,
      sombrillas: planoStats.sombrillas.unitIds,
      temporada: planoStats.mixUnitIds.temporada,
      periodo: planoStats.mixUnitIds.periodo,
      dia: planoStats.mixUnitIds.dia,
      pendientes: planoStats.pendientes.unitIds,
      libres: planoStats.libres.unitIds,
    }
    return new Set(porFiltro[statsFiltro] || [])
  }, [statsFiltro, planoStats])
  const cellHighlight = useCallback((unit) => {
    if (!highlightedUnitIds || !unit) return {}
    return highlightedUnitIds.has(unit.dbId) ? { isHighlighted: true } : { isDimmed: true }
  }, [highlightedUnitIds])

  const selectedUnit = selectedUnitId ? units[selectedUnitId] : null

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

  // Pasos de 0.2, techo 3, piso = fitScale*0.5 (se puede alejar por debajo
  // del encuadre), zoom relativo al centro del contenedor (el punto central
  // queda fijo) — mismo comportamiento en mobile y desktop.
  const handleZoomIn = () => {
    const { contW, contH } = sizesRef.current
    zoomAt(contW / 2, contH / 2, round1(transform.scale + 0.2))
  }
  const handleZoomOut = () => {
    const { contW, contH } = sizesRef.current
    zoomAt(contW / 2, contH / 2, round1(transform.scale - 0.2))
  }

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

  // Un solo nodo cumple el doble rol de "ref de la animación de slide al
  // cambiar de fecha" y "ref del viewport para medir fitScale" — nunca dos
  // elementos distintos, porque solo hay UNO montado a la vez (ver abajo).
  const setMapViewportRef = (node) => { mapSlideRef.current = node; viewportRef.current = node }

  // Grid de 3 áreas (toolbar/stats/map en mobile+tablet <1280px; left/map/
  // right en desktop >=1280px) + workspace del mapa (zoom + mapa) — un solo
  // cuerpo reusado inline y adentro del modal de pantalla completa, para no
  // duplicar el layout de las ~184 <Cell>. `fullscreen` solo cambia el botón
  // de maximizar/minimizar: el resto del árbol es idéntico a propósito
  // (WYSIWYG entre vista normal y pantalla completa). La impresión A4 no
  // vive acá — sale de `PlanoImpresion` por fuera de `.no-print`, sin tocar.
  const renderPlanoBody = (fullscreen) => (
    <div className="plano-layout flex-1 min-h-0">
      {/* Toolbar compacto: mobile + tablet (<1280px) — navegación de fecha
          (izquierda) + Imprimir A4 (derecha), igual que siempre. */}
      <div className="plano-area-toolbar flex flex-wrap justify-between items-center gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => goToDate(shiftDate(selectedDate, -1))}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
            title="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <DateInput value={selectedDate} onChange={(v) => v && goToDate(v)} className="w-36" />
          <button
            onClick={() => goToDate(shiftDate(selectedDate, 1))}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
            title="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
          {!esHoy && (
            <button
              onClick={() => goToDate(todayStr())}
              className="text-[10px] font-bold uppercase tracking-widest text-[#FDE047] hover:text-yellow-300 transition-all px-2"
            >
              Volver a hoy
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="glass-card px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"><Printer size={14} /> Imprimir A4</button>
        </div>
      </div>

      {/* Stats compacto: mismo PlanoStatsBar de siempre, carrusel horizontal
          con snap en mobile, fila con scroll horizontal en tablet. */}
      <div className="plano-area-stats shrink-0">
        <PlanoStatsBar
          stats={planoStats}
          selectedDate={selectedDate}
          filtro={statsFiltro}
          onToggleFiltro={toggleStatsFiltro}
          loading={loading}
        />
      </div>

      {/* Riel izquierdo: solo desktop >=1280px (oculto por CSS en el resto,
          ver <style> más abajo). Mismas tarjetas que el stats compacto,
          reusadas vía los named exports de PlanoStatsBar.jsx — ninguna
          lógica/dato nuevo, solo otra disposición y ancho. */}
      <div className="plano-area-left">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToDate(shiftDate(selectedDate, -1))}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all shrink-0"
            title="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <DateInput value={selectedDate} onChange={(v) => v && goToDate(v)} className="flex-1 min-w-0" />
          <button
            onClick={() => goToDate(shiftDate(selectedDate, 1))}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all shrink-0"
            title="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {!esHoy && (
          <button
            onClick={() => goToDate(todayStr())}
            className="self-start text-[10px] font-bold uppercase tracking-widest text-[#FDE047] hover:text-yellow-300 transition-all"
          >
            Volver a hoy
          </button>
        )}

        {!loading && planoStats && (
          <>
            <OcupacionCard stats={planoStats} filtro={statsFiltro} onToggleFiltro={toggleStatsFiltro} size="lg" className="w-full" />
            <div className="grid grid-cols-2 gap-2.5">
              <CarpasCard stats={planoStats} filtro={statsFiltro} onToggleFiltro={toggleStatsFiltro} className="w-full" />
              <SombrillasCard stats={planoStats} filtro={statsFiltro} onToggleFiltro={toggleStatsFiltro} className="w-full" />
            </div>
            <LibresCard stats={planoStats} filtro={statsFiltro} onToggleFiltro={toggleStatsFiltro} className="w-full" />
            <MixCard stats={planoStats} filtro={statsFiltro} onToggleFiltro={toggleStatsFiltro} className="w-full" />
          </>
        )}

        <div className="flex-1" />
        <EstadoLegend />
      </div>

      {/* Workspace del mapa — único árbol, siempre presente (ver CSS: en
          <1280px ocupa toda la fila "map"; en >=1280px queda entre los dos
          rieles). */}
      <div className="plano-area-map glass-card rounded-3xl glass-card-inner relative overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-[10px] font-bold uppercase tracking-widest">
            Cargando plano…
          </div>
        ) : (
          <>
            <PlanoViewport
              transform={transform}
              ready={ready}
              isDragging={isDragging}
              canPan={sizesRef.current.contentW * transform.scale > sizesRef.current.contW || sizesRef.current.contentH * transform.scale > sizesRef.current.contH}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onEncuadrar={handleEncuadrar}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMapMouseDown={handleMapMouseDown}
              onMapWheel={handleMapWheel}
              onAnimationEnd={(e) => e.currentTarget.classList.remove("plano-slide-left", "plano-slide-right")}
              viewportRef={setMapViewportRef}
              contentRef={contentRef}
              extraButtons={fullscreen ? (
                <button onClick={() => setFullscreenOpen(false)} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all" title="Cerrar pantalla completa">
                  <Shrink size={18} />
                </button>
              ) : (
                <button onClick={() => setFullscreenOpen(true)} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all" title="Ver en pantalla completa">
                  <Expand size={18} />
                </button>
              )}
            >
              <PlanoGrid unidades={unidades} renderCelda={renderCelda} />
            </PlanoViewport>
          </>
        )}
      </div>

      {/* Riel derecho: solo desktop >=1280px — Imprimir A4 como acción
          primaria + las tres tarjetas restantes, mismos componentes que el
          stats compacto. */}
      <div className="plano-area-right">
        <button
          onClick={() => window.print()}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#FDE047] hover:bg-yellow-300 text-black transition-all flex items-center justify-center gap-2"
        >
          <Printer size={16} /> Imprimir A4
        </button>

        {!loading && planoStats && (
          <>
            <PendientesCard stats={planoStats} filtro={statsFiltro} onToggleFiltro={toggleStatsFiltro} className="w-full" />
            <IngresosCard stats={planoStats} className="w-full" />
            <ClimaCard selectedDate={selectedDate} className="w-full" />
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col animate-premium-fade overflow-hidden">
    <div className="no-print flex-1 flex flex-col space-y-4 overflow-hidden pb-4">
      {!fullscreenOpen && renderPlanoBody(false)}

      {fullscreenOpen && createPortal(
        <div
          className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setFullscreenOpen(false)}
        >
          <div
            ref={bindFullscreen}
            onClick={(e) => e.stopPropagation()}
            className="plano-fullscreen-sheet w-full h-full sm:w-[90vw] sm:h-[90vh] glass-card sm:rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col space-y-4 p-4 sm:p-6 animate-in zoom-in-95 duration-200"
          >
            {renderPlanoBody(true)}
          </div>
        </div>,
        document.body,
      )}

      {selectedUnit && (
        <UnidadPreviewModal
          unit={selectedUnit}
          reservas={reservas}
          temporadaActiva={temporadaActiva}
          onClose={() => setSelectedUnitId(null)}
          onAsignarTemporada={(unit) => { setSelectedUnitId(null); setAsignarUnit(unit) }}
          onMoverUnidad={(reserva, unit) => { setSelectedUnitId(null); setMoverTarget({ reserva, unit }) }}
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
    {!loading && <PlanoImpresion units={units} selectedDate={selectedDate} stats={planoStats} clima={climaDelDia} />}

      <style>{`
        /* Grid de 3 áreas del Plano (oct 2026) — mobile/tablet (<1280px):
           toolbar + stats arriba, mapa abajo, una sola columna. Desktop
           (>=1280px): riel izquierdo 280px / mapa flexible / riel derecho
           280px, en una sola fila. Nunca afecta la impresión — @media print
           no toca estas clases, y PlanoImpresion.jsx vive fuera de
           .no-print con su propio layout de siempre. */
        .plano-layout {
          display: grid;
          grid-template-areas: "toolbar" "stats" "map";
          grid-template-columns: 1fr;
          grid-template-rows: auto auto 1fr;
          gap: 16px;
          min-height: 0;
        }
        /* min-width: 0 en las tres áreas de la columna única (menos de
           1280px de ancho): una columna 1fr de grid es en realidad
           minmax(auto, 1fr) — su tamaño mínimo es el máximo de los
           min-content de TODOS los items que comparten esa columna, no
           solo el que de hecho desborda. Sin esto en .plano-area-stats, la
           tira horizontal de PlanoStatsBar (varias tarjetas en fila,
           pensada para hacer scroll-x) empujaba el ancho de toda la
           columna, y con ella el plano, mucho más allá del viewport en
           mobile (bug real: el plano se veía roto/vacío en 360/390px,
           Fase 4A hotfix). */
        .plano-area-toolbar { grid-area: toolbar; min-width: 0; }
        .plano-area-stats { grid-area: stats; min-width: 0; }
        .plano-area-map { grid-area: map; min-height: 0; min-width: 0; }
        .plano-area-left, .plano-area-right { display: none; }
        @media (min-width: 1280px) {
          .plano-layout {
            grid-template-areas: "left map right";
            grid-template-columns: 280px 1fr 280px;
            grid-template-rows: 1fr;
            gap: 24px;
          }
          .plano-area-toolbar, .plano-area-stats { display: none; }
          .plano-area-left, .plano-area-right {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-height: 0;
            overflow-y: auto;
          }
        }

        /* Pantalla completa del plano en mobile (<640px, donde el modal ya
           es w-full h-full, borde a borde): reserva las safe areas del
           dispositivo (notch arriba, home indicator abajo) sumadas al
           padding de siempre (p-4), para que los botones de zoom y el de
           salir nunca queden debajo de ellas. Desktop (sm:, >=640px) no se
           toca — ahí el modal ya no llega a los bordes reales de pantalla. */
        @media (max-width: 639.98px) {
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
        .overflow-auto::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        .overflow-auto::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .overflow-auto::-webkit-scrollbar-thumb:hover { background: #FDE047; }
      `}</style>
    </div>
  )
}

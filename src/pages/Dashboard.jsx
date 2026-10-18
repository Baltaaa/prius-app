import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabase"
import { Printer, Expand, Shrink, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock, Layers } from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnidadPreviewModal from "../components/dashboard/UnidadPreviewModal"
import UnidadDetallePanel from "../components/dashboard/UnidadDetallePanel"
import PlanoMobile from "../components/dashboard/PlanoMobile"
import AsignarUnidadModal from "../components/dashboard/AsignarUnidadModal"
import MoverUnidadDialog from "../components/dashboard/MoverUnidadDialog"
import Cell from "../components/dashboard/Cell"
import CellMobile from "../components/dashboard/CellMobile"
import PlanoZoomBar from "../components/dashboard/PlanoZoomBar"
import PlanoLeyenda from "../components/dashboard/PlanoLeyenda"
import PlanoImpresion from "../components/dashboard/PlanoImpresion"
import PlanoGrid from "../components/plano/PlanoGrid"
import PlanoViewport from "../components/plano/PlanoViewport"
import { pct } from "../components/dashboard/PlanoStatsBar"
import { useData } from "../context/DataProvider"
import { calcularPlanoStats } from "../lib/planoStats"
import { buildUnitsMap } from "../lib/planoUnits"
import { formatPesos } from "../lib/format"
import DateInput from "../components/inputs/DateInput"
import { useDeepLinkTarget } from "../hooks/useDeepLinkTarget"
import { useOverlay } from "../context/OverlayProvider"
import { useClima } from "../hooks/useClima"
import { useInitialLoad } from "../hooks/useInitialLoad"
import Skeleton from "../components/ui/Skeleton"

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
  const { unidades, reservas, loading, temporadaActiva, cajaHoy, historialCajas, pagos, realtimeConectado } = useData()
  // B2 (oct 2026): `loading` es el flag global del DataProvider (compartido
  // por toda la app) — este hook solo decide cuándo mostrar el skeleton de
  // ESTA pantalla la primera vez; si el usuario ya navegó por otra pantalla
  // antes, `loading` ya viene en false y acá ni se nota.
  const readyPlano = useInitialLoad(loading)

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
  // Mobile (<768px, hotfix oct 2026): nunca se auto-achica para entrar en
  // los dos ejes — eso era la causa real de las celdas microscópicas ("el
  // componente desktop escalado" que reportó el dueño). El plano mobile
  // arranca siempre a escala 1 (tamaño real de CellMobile, min 44x36) y, si
  // no entra en algún eje, el pan/pinch-zoom ya existente resuelve el resto
  // — nunca scroll de la página. `fitScale` (piso del zoom-out) queda fijo
  // en 1*0.5 acá, independiente del tamaño real del contenido.
  const computeFit = (contW, contH, contentW, contentH) => {
    if (isMobile) return 1
    return Math.min((contW - PLANO_PAD * 2) / contentW, (contH - PLANO_PAD * 2) / contentH)
  }
  const centeredPos = (contW, contH, contentW, contentH, scale) => ({
    x: (contW - contentW * scale) / 2,
    y: (contH - contentH * scale) / 2,
  })
  // Mobile, posición inicial (no `centeredPos`): a escala 1 el contenido
  // real del plano (franja Recreación/Acceso/Pileta + 6 columnas de carpas +
  // sombrillas + "Océano Atlántico") excede por mucho los ~340px de ancho
  // útil de un celular — centrar matemáticamente arrancaba mostrando un
  // tramo vacío del medio (el hueco entre bloques), en vez de la esquina
  // superior izquierda real (Recreación + carpa 1). clampPan(0,0,scale)
  // ancla arriba-izquierda cuando desborda y centra solo si en algún eje
  // entra entero — mismo helper que ya usa el pan por drag/pinch.
  const anchorPos = (scale) => clampPan(0, 0, scale)
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
        setTransform({ scale: fit, ...(isMobile ? anchorPos(fit) : centeredPos(contW, contH, contentW, contentH, fit)) })
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
    // `isMobile` en las deps: si se cruza el breakpoint 768px con la pantalla
    // ya montada (resize del navegador), el observer tiene que releer el
    // `computeFit` nuevo (closure fresca) — si no, seguía auto-encuadrando
    // con la fórmula vieja hasta el próximo cambio de `fullscreenOpen`/
    // `loading`.
  }, [fullscreenOpen, loading, isMobile])

  const handleEncuadrar = () => {
    userInteractedRef.current = false
    setUserInteractedState(false)
    const { contW, contH, contentW, contentH } = sizesRef.current
    const fit = computeFit(contW, contH, contentW, contentH)
    setFitScale(fit)
    setTransform({ scale: fit, ...(isMobile ? anchorPos(fit) : centeredPos(contW, contH, contentW, contentH, fit)) })
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

  // Mapa de unidades con estado derivado para `selectedDate` — extraído a
  // `lib/planoUnits.js` (oct 2026) para que el Dashboard real
  // (`pages/crm/Home.jsx`) calcule sus KPIs de ocupación con el mismo
  // criterio exacto, sin duplicar la regla. Mismo resultado que antes.
  const units = useMemo(
    () => buildUnitsMap(unidades, reservas, selectedDate),
    [unidades, reservas, selectedDate],
  )

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
  const canPanAhora = sizesRef.current.contentW * transform.scale > sizesRef.current.contW || sizesRef.current.contentH * transform.scale > sizesRef.current.contH

  const renderPlanoBody = (fullscreen) => {
    // Mismo estilo claro que PlanoZoomBar (ya no glass-card oscuro): este
    // botón ahora vive DENTRO de esa barra, no flotando sobre el mapa.
    const extraButtonsViewport = (
      fullscreen ? (
        <button onClick={() => setFullscreenOpen(false)} className="w-9 h-9 rounded-lg bg-prius-subtle hover:bg-[#EEEEEE] text-black flex items-center justify-center transition-colors" title="Cerrar pantalla completa">
          <Shrink size={16} />
        </button>
      ) : (
        <button onClick={() => setFullscreenOpen(true)} className="w-9 h-9 rounded-lg bg-prius-subtle hover:bg-[#EEEEEE] text-black flex items-center justify-center transition-colors" title="Ver en pantalla completa">
          <Expand size={16} />
        </button>
      )
    )
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
          statsFiltro={statsFiltro}
          onToggleFiltro={toggleStatsFiltro}
          transform={transform}
          ready={ready}
          isDragging={isDragging}
          canPan={canPanAhora}
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
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreenOpen(!fullscreen)}
          unidades={unidades}
          renderCelda={renderCeldaMobile}
          extraButtonsViewport={extraButtonsViewport}
        />
      )
    }

    // Desktop/tablet (≥768px, mock 02-plano-desktop / 02-plano-tablet):
    // misma franja superior para los dos, grilla de KPIs/filtros responsive
    // (flex en desktop, grid-cols-3 + scroll-x en tablet vía Tailwind). El
    // panel lateral fijo (UnidadDetallePanel) solo se ve en ≥1024px —
    // tablet sigue usando la hoja inferior (UnidadPreviewModal) para el
    // detalle, como pide la tarea.
    const diaSemana = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '')

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        {/* Franja superior */}
        <div className="card-light rounded-2xl p-3 md:p-space-md flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap xl:flex-nowrap">
            {/* Selector de fecha */}
            <div className="flex items-center gap-1 bg-prius-subtle p-1 rounded-xl shrink-0">
              <button onClick={() => goToDate(shiftDate(selectedDate, -1))} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-prius-slate hover:bg-hairline transition-colors" title="Día anterior">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1.5 px-1">
                {/* calendarOnly: mismo DateInput/calendario de siempre, con el
                    look del mock (texto + día de semana) en vez del input
                    con borde por defecto — "el mismo selector y handler". */}
                <DateInput value={selectedDate} onChange={(v) => v && goToDate(v)} calendarOnly className="w-[148px]" />
                <span className="text-label-md text-prius-slate uppercase shrink-0">{diaSemana}</span>
                {!esHoy && (
                  <button onClick={() => goToDate(todayStr())} className="text-label-md text-gold hover:text-black font-bold uppercase ml-1 shrink-0">Hoy</button>
                )}
              </div>
              <button onClick={() => goToDate(shiftDate(selectedDate, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-prius-slate hover:bg-hairline transition-colors" title="Día siguiente">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 3 KPIs reales: Ocupadas / Libres / Pendientes */}
            {planoStats && (
              <div className="grid grid-cols-3 md:flex gap-2 flex-1 md:max-w-2xl">
                <button onClick={() => toggleStatsFiltro('ocupacion')} className={`flex-1 min-w-0 md:min-w-[170px] p-2.5 rounded-xl flex items-center gap-2 text-left transition-colors ${statsFiltro === 'ocupacion' ? 'bg-gold/10 ring-1 ring-gold/50' : 'bg-prius-subtle'}`}>
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-black text-white flex items-center justify-center"><CalendarDays size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-label-md text-prius-slate uppercase truncate">Ocupadas</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-headline-sm text-black tabular-nums">{planoStats.ocupacion.count}</span>
                      <span className="text-body-sm text-prius-slate">{pct(planoStats.ocupacion.pct)}</span>
                    </span>
                  </span>
                </button>
                <button onClick={() => toggleStatsFiltro('libres')} className={`flex-1 min-w-0 md:min-w-[170px] p-2.5 rounded-xl flex items-center gap-2 text-left transition-colors ${statsFiltro === 'libres' ? 'bg-gold/10 ring-1 ring-gold/50' : 'bg-prius-subtle'}`}>
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-green-100 text-prius-success flex items-center justify-center"><CheckCircle2 size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-label-md text-prius-slate uppercase truncate">Libres</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-headline-sm text-black tabular-nums">{planoStats.libres.count}</span>
                      <span className="text-body-sm text-prius-success font-semibold">{pct(planoStats.libres.count / Math.max(1, planoStats.ocupacion.total))}</span>
                    </span>
                  </span>
                </button>
                <button onClick={() => toggleStatsFiltro('pendientes')} className={`flex-1 min-w-0 md:min-w-[210px] p-2.5 rounded-xl flex items-center gap-2 text-left transition-colors ${statsFiltro === 'pendientes' ? 'bg-gold/10 ring-1 ring-gold/50' : 'bg-prius-subtle'}`}>
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-gold text-black flex items-center justify-center"><Clock size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-label-md text-prius-slate uppercase truncate">Pendientes ({planoStats.pendientes.count})</span>
                    <span className="block text-headline-sm text-black tabular-nums truncate">{planoStats.pendientes.saldo > 0 ? formatPesos(planoStats.pendientes.saldo) : '—'}</span>
                  </span>
                </button>
              </div>
            )}

            <button onClick={() => window.print()} className="h-11 px-4 bg-prius-surface hover:bg-hairline text-black rounded-xl flex items-center gap-2 text-title-md shrink-0 transition-colors">
              <Printer size={16} /> <span className="hidden sm:inline">Imprimir A4</span>
            </button>
          </div>

          {/* Filtros: tipo + estado + leyenda */}
          <div className="flex items-center gap-3 overflow-x-auto md:flex-wrap pb-0.5 md:pb-0 scrollbar-none">
            <div className="flex items-center bg-prius-subtle p-1 rounded-full gap-1 shrink-0">
              {[['todo', 'Todo', planoStats?.ocupacion.total], ['carpas', 'Carpas', planoStats?.carpas.total], ['sombrillas', 'Sombrillas', planoStats?.sombrillas.total]].map(([key, label, total]) => (
                <button
                  key={key}
                  onClick={() => key === 'todo' ? setStatsFiltro(null) : toggleStatsFiltro(key)}
                  className={`px-3.5 py-1 rounded-full text-label-lg whitespace-nowrap transition-colors ${
                    (key === 'todo' ? !statsFiltro : statsFiltro === key) ? 'bg-black text-white' : 'text-prius-slate hover:text-black'
                  }`}
                >
                  {label}{total != null ? ` (${total})` : ''}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" />
            <div className="flex items-center gap-1.5 shrink-0">
              {[['todas', 'Todas', null], ['libres', 'Libres', planoStats?.libres.count], ['ocupacion', 'Ocupadas', planoStats?.ocupacion.count], ['pendientes', 'Pendientes', planoStats?.pendientes.count]].map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => key === 'todas' ? setStatsFiltro(null) : toggleStatsFiltro(key)}
                  className={`h-8 px-3 rounded-full text-label-md uppercase whitespace-nowrap transition-colors ${
                    (key === 'todas' ? !statsFiltro : statsFiltro === key) ? 'bg-gold text-black' : 'bg-prius-surface text-black hover:bg-hairline'
                  }`}
                >
                  {label}{count != null ? ` (${count})` : ''}
                </button>
              ))}
            </div>
            <div className="hidden lg:block ml-auto shrink-0">
              <PlanoLeyenda />
            </div>
          </div>
        </div>

        {/* Workspace: grid (sin tocar) + panel lateral fijo (desktop) */}
        <div className="flex-1 min-h-0 flex gap-4">
          <section className="flex-1 card-light rounded-2xl card-light-inner relative overflow-hidden flex flex-col">
            <div className="px-4 md:px-space-lg pt-3 md:pt-space-md flex items-center justify-between gap-2 shrink-0">
              <span className="flex items-center gap-2 text-prius-slate">
                <Layers size={16} />
                <span className="text-label-lg uppercase tracking-wider">Pasillo A · Pasillo B · Pasillo C</span>
              </span>
              {realtimeConectado && (
                <span className="hidden sm:inline-flex items-center gap-1.5 bg-prius-subtle px-3 py-1 rounded-full text-prius-slate">
                  <span className="w-2 h-2 rounded-full bg-prius-success" />
                  <span className="text-label-md uppercase">{planoStats?.ocupacion.total || 0} unidades sincronizadas</span>
                </span>
              )}
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-prius-muted text-[10px] font-bold uppercase tracking-widest">
                Cargando plano…
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex gap-2 px-2 pb-2">
                {/* `[&>div:first-child]:hidden` oculta la barra de zoom propia
                    de PlanoViewport.jsx (congelado, vive adentro con
                    position:absolute encima del mapa) sin tocar ese archivo —
                    PlanoZoomBar.jsx la reemplaza acá al lado, fuera del mapa,
                    llamando a las mismas funciones. */}
                <div className="flex-1 min-h-0 flex flex-col relative [&>div:first-child]:hidden">
                  <PlanoViewport
                    transform={transform}
                    ready={ready}
                    isDragging={isDragging}
                    canPan={canPanAhora}
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
                  >
                    <PlanoGrid unidades={unidades} renderCelda={renderCelda} />
                  </PlanoViewport>
                </div>
                <PlanoZoomBar onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onEncuadrar={handleEncuadrar} extraButtons={extraButtonsViewport} />
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
      <div className="h-full flex flex-col overflow-hidden font-ui p-4 gap-4">
        <Skeleton className="h-24 shrink-0" />
        <div className="flex-1 flex gap-4 min-h-0">
          <Skeleton className="flex-1" />
          <Skeleton className="hidden lg:block w-96 shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col animate-premium-fade overflow-hidden font-ui">
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
            className="plano-fullscreen-sheet w-full h-full sm:w-[90vw] sm:h-[90vh] card-light sm:rounded-3xl overflow-hidden border border-hairline flex flex-col space-y-4 p-4 sm:p-6 animate-in zoom-in-95 duration-200"
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

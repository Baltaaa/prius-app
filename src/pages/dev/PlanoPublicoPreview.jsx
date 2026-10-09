import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { isFeatureEnabled } from "../../lib/features"
import PlanoGrid from "../../components/plano/PlanoGrid"
import PlanoViewport from "../../components/plano/PlanoViewport"
import CeldaPublica from "../../components/plano/CeldaPublica"
import DateInput from "../../components/inputs/DateInput"
import IntegerInput from "../../components/inputs/IntegerInput"

const todayStr = () => new Date().toISOString().split("T")[0]
const TIPO_LABEL = { carpa: "Carpa", sombrilla: "Sombrilla" }
const PLANO_PAD = 24

/**
 * Fase 4A, Tarea 5 (oct 2026) — vista previa interna de la variante pública
 * del plano: exactamente lo que va a hacer la landing (beachFlow, Fase 4B),
 * pero dentro del CRM y con datos reales, para poder probarla antes de
 * copiar src/components/plano/ afuera. Herramienta de desarrollo — ruta
 * protegida por permiso 'plano_publico_preview' (solo superadmin) y por el
 * flag `plano_publico_preview` en lib/features.ts. No reserva nada: solo
 * marca selección/sugerencia en pantalla.
 *
 * Usa disponibilidad_publica()/buscar_unidad_vecina() — las mismas RPC que
 * usará la landing sin login — con el cliente Supabase autenticado del CRM
 * (ambas funciones tienen EXECUTE para `authenticated` además de `anon`).
 *
 * `PlanoViewport` no guarda estado propio (ver src/components/plano/
 * PORTABILIDAD.md) — a diferencia de Dashboard.jsx, acá no hace falta el
 * modo mobile de pinch simple (herramienta de escritorio, uso interno), así
 * que esta página solo implementa el modo fit-to-container (pan por drag +
 * Ctrl+rueda + botones), simplificado respecto al de Dashboard.jsx.
 */
export default function PlanoPublicoPreview() {
  const [desde, setDesde] = useState(todayStr())
  const [hasta, setHasta] = useState(todayStr())
  const [personas, setPersonas] = useState(2)
  const [disponibilidad, setDisponibilidad] = useState([])
  const [loadingDisp, setLoadingDisp] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState(null) // fila de disponibilidad_publica
  const [suggestedUnit, setSuggestedUnit] = useState(null) // + contigua (de buscar_unidad_vecina)

  const fetchDisponibilidad = useCallback(async () => {
    if (!desde || !hasta || hasta < desde) return
    setLoadingDisp(true)
    const { data, error } = await supabase.rpc("disponibilidad_publica", { p_desde: desde, p_hasta: hasta })
    if (error) {
      console.error("disponibilidad_publica:", error.message)
    } else {
      setDisponibilidad(data || [])
    }
    setLoadingDisp(false)
  }, [desde, hasta])

  useEffect(() => {
    fetchDisponibilidad()
  }, [fetchDisponibilidad])

  // La landing nunca ve postgres_changes (anon no puede suscribirse) — usa
  // Broadcast en el canal 'disponibilidad', evento 'cambio', con debounce
  // ~500ms (ver CLAUDE.md "Sistema de reservas públicas"). Esta vista previa
  // reusa el mismo mecanismo para probarlo de punta a punta.
  useEffect(() => {
    let debounceId = null
    const channel = supabase
      .channel("disponibilidad")
      .on("broadcast", { event: "cambio" }, () => {
        clearTimeout(debounceId)
        debounceId = setTimeout(fetchDisponibilidad, 500)
      })
      .subscribe()
    return () => {
      clearTimeout(debounceId)
      supabase.removeChannel(channel)
    }
  }, [fetchDisponibilidad])

  // Al cambiar de unidad primaria o de cantidad de personas, si la
  // capacidad no alcanza y todavía no hay sugerencia (automática o elegida
  // a mano), se busca la vecina — misma función que usará
  // crear_reserva_publica en el flujo real.
  useEffect(() => {
    if (!selectedUnit) return
    if (personas <= selectedUnit.capacidad) {
      setSuggestedUnit(null)
      return
    }
    if (suggestedUnit) return
    let cancelado = false
    supabase
      .rpc("buscar_unidad_vecina", { p_unidad: selectedUnit.unidad_id, p_desde: desde, p_hasta: hasta })
      .then(({ data, error }) => {
        if (cancelado || error || !data?.length) return
        const vecina = data[0]
        const completa = disponibilidad.find((u) => u.unidad_id === vecina.unidad_id)
        if (completa) setSuggestedUnit({ ...completa, contigua: vecina.contigua })
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit, personas, desde, hasta, disponibilidad])

  const handleUnitClick = useCallback(
    (slot) => {
      if (!slot?.unidad_id || slot.bloqueada) return
      if (selectedUnit?.unidad_id === slot.unidad_id) {
        setSelectedUnit(null)
        setSuggestedUnit(null)
        return
      }
      if (suggestedUnit?.unidad_id === slot.unidad_id) {
        setSuggestedUnit(null)
        return
      }
      // Otra unidad libre del mismo tipo que la primaria ya elegida:
      // reemplaza la sugerencia a mano, sin pisar la selección primaria.
      if (selectedUnit && slot.tipo === selectedUnit.tipo) {
        setSuggestedUnit(slot)
        return
      }
      setSelectedUnit(slot)
      setSuggestedUnit(null)
    },
    [selectedUnit, suggestedUnit],
  )

  const renderCelda = useCallback(
    (slot) => {
      const estado = !slot.unidad_id || slot.bloqueada
        ? "bloqueada"
        : slot.unidad_id === selectedUnit?.unidad_id
          ? "seleccionada"
          : slot.unidad_id === suggestedUnit?.unidad_id
            ? "sugerida"
            : "libre"
      return (
        <CeldaPublica
          key={`${slot.tipo}-${slot.numero}`}
          numero={slot.numero}
          estado={estado}
          numberSide={slot.numberSide}
          onClick={() => handleUnitClick(slot)}
        />
      )
    },
    [selectedUnit, suggestedUnit, handleUnitClick],
  )

  const resumenSeleccion = useMemo(() => {
    if (!selectedUnit) return null
    const partes = [selectedUnit, suggestedUnit].filter(Boolean).map((u) => `${TIPO_LABEL[u.tipo] || u.tipo} ${u.numero}`)
    return `${partes.join(" + ")} · ${personas} persona${personas === 1 ? "" : "s"}`
  }, [selectedUnit, suggestedUnit, personas])

  // --- Fit-to-container simplificado (sin modo mobile de pinch, ver nota
  // de arriba) — mismo cálculo que Dashboard.jsx (Tarea 4), recortado a lo
  // que esta herramienta necesita.
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const sizesRef = useRef({ contW: 0, contH: 0, contentW: 0, contentH: 0 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startX0: 0, startY0: 0 })
  const [fitScale, setFitScale] = useState(1)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const round1 = (n) => Math.round(n * 10) / 10
  const computeFit = (contW, contH, contentW, contentH) =>
    Math.min((contW - PLANO_PAD * 2) / contentW, (contH - PLANO_PAD * 2) / contentH)
  const centeredPos = (contW, contH, contentW, contentH, scale) => ({
    x: (contW - contentW * scale) / 2,
    y: (contH - contentH * scale) / 2,
  })
  const clampScale = (s) => Math.min(3, Math.max(fitScale * 0.5, s))
  const clampPan = (x, y, scale) => {
    const { contW, contH, contentW, contentH } = sizesRef.current
    const scaledW = contentW * scale
    const scaledH = contentH * scale
    const cx = scaledW <= contW ? (contW - scaledW) / 2 : Math.min(0, Math.max(contW - scaledW, x))
    const cy = scaledH <= contH ? (contH - scaledH) / 2 : Math.min(0, Math.max(contH - scaledH, y))
    return { x: cx, y: cy }
  }

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
      setTransform({ scale: fit, ...centeredPos(contW, contH, contentW, contentH, fit) })
      setReady(true)
    }
    aplicarEncuadre()
    const ro = new ResizeObserver(aplicarEncuadre)
    ro.observe(viewport)
    ro.observe(content)
    return () => ro.disconnect()
  }, [loadingDisp])

  const zoomAt = (px, py, targetScale) => {
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
  const handleZoomIn = () => {
    const { contW, contH } = sizesRef.current
    zoomAt(contW / 2, contH / 2, round1(transform.scale + 0.2))
  }
  const handleZoomOut = () => {
    const { contW, contH } = sizesRef.current
    zoomAt(contW / 2, contH / 2, round1(transform.scale - 0.2))
  }
  const handleEncuadrar = () => {
    const { contW, contH, contentW, contentH } = sizesRef.current
    const fit = computeFit(contW, contH, contentW, contentH)
    setFitScale(fit)
    setTransform({ scale: fit, ...centeredPos(contW, contH, contentW, contentH, fit) })
  }
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
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [])
  const handleMapWheel = (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const rect = viewportRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    zoomAt(px, py, round1(transform.scale + delta))
  }
  const canPan = sizesRef.current.contentW * transform.scale > sizesRef.current.contW
    || sizesRef.current.contentH * transform.scale > sizesRef.current.contH

  if (!isFeatureEnabled("plano_publico_preview")) {
    return <Navigate to="/app/home" replace />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-premium-fade">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden pb-4">
        <div className="shrink-0">
          <h1 className="text-lg font-bold text-white">Vista previa — Plano público</h1>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">
            Herramienta interna (solo superadmin) — no crea ninguna reserva
          </p>
        </div>

        <div className="shrink-0 flex flex-wrap items-end gap-3">
          <DateInput label="Desde" value={desde} onChange={(v) => v && setDesde(v)} className="w-36" />
          <DateInput label="Hasta" value={hasta} onChange={(v) => v && setHasta(v)} min={desde} className="w-36" />
          <IntegerInput label="Personas" value={personas} onChange={(n) => setPersonas(n || 1)} min={1} max={40} className="w-28" />
        </div>

        <div className="flex-1 min-h-0 glass-card rounded-3xl glass-card-inner relative overflow-hidden flex flex-col">
          {loadingDisp && disponibilidad.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-[10px] font-bold uppercase tracking-widest">
              Cargando disponibilidad…
            </div>
          ) : (
            <PlanoViewport
              isFitMode
              transform={transform}
              ready={ready}
              isDragging={isDragging}
              canPan={canPan}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onEncuadrar={handleEncuadrar}
              onMapMouseDown={handleMapMouseDown}
              onMapWheel={handleMapWheel}
              viewportRef={viewportRef}
              contentRef={contentRef}
            >
              <PlanoGrid unidades={disponibilidad} renderCelda={renderCelda} />
            </PlanoViewport>
          )}
        </div>

        {resumenSeleccion && (
          <div className="shrink-0 glass-card rounded-2xl px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{resumenSeleccion}</span>
            <button
              onClick={() => { setSelectedUnit(null); setSuggestedUnit(null) }}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

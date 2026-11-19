import { useEffect, useLayoutEffect, useRef, useState } from "react"

// Zoom, encuadre y arrastre del Plano en desktop/tablet (Fase 6A: sacado tal
// cual de pages/Dashboard.jsx para que la landing tenga el mismo
// comportamiento). Alimenta a PlanoViewport.jsx, que es 100% controlado.
// Portable: solo react (ver PORTABILIDAD.md).
//
// Un solo modo para cualquier tamaño: fit-to-container, zoom relativo al punto
// (botones = centro, Ctrl+rueda = cursor, pinch = punto medio de los dedos) y
// pan por drag (mouse o un dedo). Mouse y touch alimentan el mismo `transform`.
//
// Estructura que espera (PlanoViewport): `viewportRef` = contenedor con
// overflow:hidden; `contentRef` = capa transformada absolute top/left 0 con
// transform-origin 0 0 y el plano en su tamaño intrínseco adentro.
//
// `isMobile`: nunca se auto-achica (arranca a escala 1, anclado arriba a la
// izquierda). `remedir`: cualquier valor que, al cambiar, obliga a volver a
// medir (el CRM pasa pantalla completa / loading / skeleton: el nodo real del
// viewport recién existe después).
const PLANO_PAD = 8 // aire alrededor del plano dentro de su caja
const round1 = (n) => Math.round(n * 10) / 10

export default function usePlanoEncuadre({ isMobile = false, remedir } = {}) {
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const sizesRef = useRef({ contW: 0, contH: 0, contentW: 0, contentH: 0 })
  const userInteractedRef = useRef(false) // ref: el closure del ResizeObserver siempre lee el valor actual
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startX0: 0, startY0: 0 })

  const [fitScale, setFitScale] = useState(1)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const [ready, setReady] = useState(false) // oculto hasta la primera medición válida
  const [, setUserInteractedState] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const computeFit = (contW, contH, contentW, contentH) => {
    if (isMobile) return 1
    return Math.min((contW - PLANO_PAD * 2) / contentW, (contH - PLANO_PAD * 2) / contentH)
  }
  const centeredPos = (contW, contH, contentW, contentH, scale) => ({
    x: (contW - contentW * scale) / 2,
    y: (contH - contentH * scale) / 2,
  })
  // Si el plano escalado entra en el eje, se centra; si lo excede, se limita
  // para que un borde como mucho llegue a pegarse al del contenedor.
  const clampPan = (x, y, scale) => {
    const { contW, contH, contentW, contentH } = sizesRef.current
    const scaledW = contentW * scale
    const scaledH = contentH * scale
    const cx = scaledW <= contW ? (contW - scaledW) / 2 : Math.min(0, Math.max(contW - scaledW, x))
    const cy = scaledH <= contH ? (contH - scaledH) / 2 : Math.min(0, Math.max(contH - scaledH, y))
    return { x: cx, y: cy }
  }
  // Mobile: arranca anclado arriba a la izquierda (Recreación + carpa 1), no centrado.
  const anchorPos = (scale) => clampPan(0, 0, scale)
  const clampScale = (s) => Math.min(3, Math.max(fitScale * 0.5, s))
  const markUserInteracted = () => {
    if (userInteractedRef.current) return
    userInteractedRef.current = true
    setUserInteractedState(true)
  }

  // useLayoutEffect: mide y encuadra ANTES del primer paint visible.
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
    // Observa contenedor Y contenido (fuentes/datos pueden cambiar el tamaño intrínseco).
    const ro = new ResizeObserver(aplicarEncuadre)
    ro.observe(viewport)
    ro.observe(content)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, remedir])

  const handleEncuadrar = () => {
    userInteractedRef.current = false
    setUserInteractedState(false)
    const { contW, contH, contentW, contentH } = sizesRef.current
    const fit = computeFit(contW, contH, contentW, contentH)
    setFitScale(fit)
    setTransform({ scale: fit, ...(isMobile ? anchorPos(fit) : centeredPos(contW, contH, contentW, contentH, fit)) })
  }

  // Zoom manteniendo fijo el punto (px, py) en coordenadas del contenedor.
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

  // Pan por drag del mouse, solo si el plano escalado excede el contenedor.
  // Listeners en window: sigue el arrastre aunque el cursor salga del viewport.
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

  // Ctrl+rueda: zoom relativo al cursor. Sin Ctrl la rueda no hace nada.
  const handleMapWheel = (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const rect = viewportRef.current.getBoundingClientRect()
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, round1(transform.scale + delta))
  }

  // Táctil: un dedo arrastra; dos pinchean con el zoom en el punto medio ACTUAL.
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
      const ratio = touchDistance(e.touches) / touchPinchRef.current.startDist
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

  // Botones: pasos de 0.2, techo 3, piso fitScale*0.5, centrados en el contenedor.
  const handleZoomIn = () => {
    const { contW, contH } = sizesRef.current
    zoomAt(contW / 2, contH / 2, round1(transform.scale + 0.2))
  }
  const handleZoomOut = () => {
    const { contW, contH } = sizesRef.current
    zoomAt(contW / 2, contH / 2, round1(transform.scale - 0.2))
  }

  const { contW, contH, contentW, contentH } = sizesRef.current
  const canPan = contentW * transform.scale > contW || contentH * transform.scale > contH

  return {
    viewportRef,
    contentRef,
    transform,
    ready,
    isDragging,
    canPan,
    handleEncuadrar,
    handleZoomIn,
    handleZoomOut,
    handleMapMouseDown,
    handleMapWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}

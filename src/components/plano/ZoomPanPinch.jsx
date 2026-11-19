import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

// Contenedor táctil con zoom y arrastre (Plano mobile <768px y visor del
// comprobante). En el Plano reemplaza a PlanoViewport SOLO en mobile: el desktop
// y la tablet siguen con su zoom/pan de siempre, intactos.
//
// Gestos (Pointer Events, todo con refs + requestAnimationFrame — React no
// re-renderiza ni un frame mientras se mueve el mapa):
//   - un dedo arrastra; el arrastre arranca recién al pasar 8px, así un tap
//     sobre una unidad abre su ficha sin mover el mapa por error;
//   - pinch con dos dedos: el zoom queda anclado al punto medio entre los
//     dedos (y mover los dos dedos también desplaza);
//   - doble tap acerca en ese punto (si ya está cerca del máximo, vuelve a
//     encuadrar). El tap simple sobre una unidad espera 260ms para saber si
//     viene un segundo tap; el click real se reenvía después, una sola vez.
//
// Zoom: el mínimo es "encuadrar" (el mapa completo entra y queda centrado) y
// nunca se achica más; el máximo hace cómodas las celdas (~3x del encuadre).
// El arrastre queda limitado para que el mapa no salga de la vista, con
// rebote suave en los bordes (resistencia mientras se tira, vuelve al soltar).
// Al abrir, al rotar y al cambiar `resetKey` (filtros) arranca encuadrado.
//
// Todo se escribe en UN wrapper con transform: translate3d + scale.

const UMBRAL_ARRASTRE = 8 // px: por debajo es un tap
const DOBLE_TAP_MS = 240
const DOBLE_TAP_PX = 32
const ESPERA_TAP_MS = 260 // espera del tap simple por si viene el doble
const ZOOM_MAX_REL = 3 // máximo = 3x el encuadre...
const ESCALA_MAX_MIN = 1.25 // ...pero nunca menos que celdas 25% más grandes que lo táctil mínimo
const MARGEN = 4 // aire alrededor del mapa encuadrado
const ELASTICO = 0.35
const ELASTICO_MAX = 72
const PASO_BOTONES = 1.5

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// Límites de posición en un eje. `reserva` (px, solo eje X) es una franja del
// borde derecho que el mapa encuadrado no usa: ahí flota la pill de zoom, así
// que no tapa ninguna unidad. Al acercar, el mapa sí pasa por debajo de ella.
// Continuo en los dos umbrales (cabe en lo útil → cabe en la caja → desborda).
const limitesEje = (caja, contenido, escala, reserva = 0) => {
  const tam = contenido * escala
  const util = caja - reserva
  if (tam <= util) {
    const centro = (util - tam) / 2
    return [centro, centro]
  }
  if (tam <= caja) return [0, 0]
  return [caja - tam, 0]
}
const elastico = (v, lo, hi) => {
  if (v < lo) return lo - Math.min((lo - v) * ELASTICO, ELASTICO_MAX)
  if (v > hi) return hi + Math.min((v - hi) * ELASTICO, ELASTICO_MAX)
  return v
}

/**
 * @type {import('react').ForwardRefExoticComponent<Record<string, any> & import('react').RefAttributes<any>>}
 */
const ZoomPanPinch = forwardRef(function ZoomPanPinch(
  { children, resetKey, slideRef, onAnimationEnd, reservaDerecha = 56, className = '' },
  ref,
) {
  const contenedor = useRef(null)
  const contenido = useRef(null)
  const st = useRef({ s: 1, x: 0, y: 0 })
  const dim = useRef({ cw: 0, ch: 0, w: 0, h: 0 })
  const lim = useRef({ fit: 1, max: 3 })
  const punteros = useRef(new Map())
  const gesto = useRef(null)
  const rafPintar = useRef(0)
  const rafAnim = useRef(0)
  const ultimoTap = useRef({ t: 0, x: 0, y: 0 })
  const tapPendiente = useRef(null)
  const suprimirClick = useRef(false)
  const reenviando = useRef(false)
  const primerReset = useRef(true)

  const reducido = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const pintar = () => {
    rafPintar.current = 0
    const el = contenido.current
    if (!el) return
    const { s, x, y } = st.current
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
  }
  const programar = () => {
    if (!rafPintar.current) rafPintar.current = requestAnimationFrame(pintar)
  }
  const detener = () => {
    if (rafAnim.current) cancelAnimationFrame(rafAnim.current)
    rafAnim.current = 0
  }

  // Posición válida (dentro de los límites) para una escala dada.
  const valido = (s, x, y) => {
    const { cw, ch, w, h } = dim.current
    const sc = clamp(s, lim.current.fit, lim.current.max)
    const [lx, hx] = limitesEje(cw, w, sc, reservaDerecha)
    const [ly, hy] = limitesEje(ch, h, sc)
    return { s: sc, x: clamp(x, lx, hx), y: clamp(y, ly, hy) }
  }
  const encuadrado = () => valido(lim.current.fit, 0, 0)

  const animar = (dest, ms = 300) => {
    detener()
    if (reducido() || ms <= 0) {
      st.current = dest
      pintar()
      return
    }
    const ini = { ...st.current }
    const t0 = performance.now()
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - (1 - k) ** 3
      st.current = {
        s: ini.s + (dest.s - ini.s) * e,
        x: ini.x + (dest.x - ini.x) * e,
        y: ini.y + (dest.y - ini.y) * e,
      }
      pintar()
      rafAnim.current = k < 1 ? requestAnimationFrame(paso) : 0
    }
    rafAnim.current = requestAnimationFrame(paso)
  }

  // Vuelve al rango válido (rebote) si el gesto lo dejó afuera.
  const asentar = () => {
    const { s, x, y } = st.current
    const dest = valido(s, x, y)
    if (Math.abs(dest.s - s) > 0.001 || Math.abs(dest.x - x) > 0.5 || Math.abs(dest.y - y) > 0.5) animar(dest, 320)
  }

  // Zoom manteniendo fijo el punto (px, py), en coordenadas del contenedor.
  const zoomEn = (px, py, escalaNueva, ms = 260) => {
    const { s, x, y } = st.current
    const sc = clamp(escalaNueva, lim.current.fit, lim.current.max)
    const ax = (px - x) / s
    const ay = (py - y) / s
    animar(valido(sc, px - ax * sc, py - ay * sc), ms)
  }

  const inercia = (vx, vy) => {
    detener()
    let ultimo = performance.now()
    const paso = (t) => {
      const dt = Math.min(48, t - ultimo)
      ultimo = t
      const f = 0.94 ** (dt / 16)
      vx *= f
      vy *= f
      const { s, x, y } = st.current
      const nuevo = { s, x: x + vx * dt, y: y + vy * dt }
      const v = valido(nuevo.s, nuevo.x, nuevo.y)
      const choco = v.x !== nuevo.x || v.y !== nuevo.y
      st.current = v
      pintar()
      rafAnim.current = !choco && Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(paso) : 0
    }
    rafAnim.current = requestAnimationFrame(paso)
  }

  useImperativeHandle(ref, () => ({
    acercar: () => zoomEn(dim.current.cw / 2, dim.current.ch / 2, st.current.s * PASO_BOTONES),
    alejar: () => zoomEn(dim.current.cw / 2, dim.current.ch / 2, st.current.s / PASO_BOTONES),
    encuadrar: () => animar(encuadrado(), 300),
    // Para tests y diagnóstico: escala relativa al encuadre y escala absoluta.
    estado: () => ({ ...st.current, fit: lim.current.fit, max: lim.current.max }),
  }))

  // Medición + encuadre inicial, ANTES del primer paint. Se repite cuando
  // cambia el tamaño del contenedor (rotación, teclado, barra del navegador).
  useLayoutEffect(() => {
    const c = contenedor.current
    const k = contenido.current
    if (!c || !k) return undefined
    let primero = true
    const medir = () => {
      const cw = c.clientWidth
      const ch = c.clientHeight
      const w = k.offsetWidth
      const h = k.offsetHeight
      if (!cw || !ch || !w || !h) return
      const previo = dim.current
      const estabaEncuadrado = Math.abs(st.current.s - lim.current.fit) < 0.002
      dim.current = { cw, ch, w, h }
      const fit = Math.min((cw - reservaDerecha - MARGEN * 2) / w, (ch - MARGEN * 2) / h)
      lim.current = { fit, max: Math.max(fit * ZOOM_MAX_REL, ESCALA_MAX_MIN) }
      detener()
      if (primero || Math.abs(cw - previo.cw) > 2 || estabaEncuadrado) st.current = encuadrado()
      else st.current = valido(st.current.s, st.current.x, st.current.y)
      pintar()
      if (primero) {
        k.style.visibility = 'visible'
        primero = false
      }
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(c)
    ro.observe(k)
    return () => {
      ro.disconnect()
      detener()
      if (rafPintar.current) cancelAnimationFrame(rafPintar.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cambio de filtro: vuelve a encuadrar.
  useEffect(() => {
    if (primerReset.current) {
      primerReset.current = false
      return
    }
    animar(encuadrado(), 260)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Click en captura: un tap simple se difiere para dar lugar al doble tap, y
  // el click que viene después de un arrastre o de un doble tap se descarta.
  useEffect(() => {
    const c = contenedor.current
    if (!c) return undefined
    const onClick = (ev) => {
      if (reenviando.current) return
      if (suprimirClick.current) {
        ev.stopPropagation()
        ev.preventDefault()
        return
      }
      if (ev.detail === 0) return // teclado / accesibilidad: sin demora
      ev.stopPropagation()
      ev.preventDefault()
      const objetivo = ev.target
      const init = { bubbles: true, cancelable: true, clientX: ev.clientX, clientY: ev.clientY }
      clearTimeout(tapPendiente.current)
      tapPendiente.current = setTimeout(() => {
        tapPendiente.current = null
        if (!objetivo.isConnected) return
        reenviando.current = true
        try {
          objetivo.dispatchEvent(new MouseEvent('click', init))
        } finally {
          reenviando.current = false
        }
      }, ESPERA_TAP_MS)
    }
    c.addEventListener('click', onClick, true)
    return () => {
      c.removeEventListener('click', onClick, true)
      clearTimeout(tapPendiente.current)
    }
  }, [])

  const local = (e) => {
    const r = contenedor.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const medio = () => {
    const [a, b] = [...punteros.current.values()]
    const r = contenedor.current.getBoundingClientRect()
    return { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top, d: Math.hypot(a.x - b.x, a.y - b.y) }
  }

  const iniciarPinch = () => {
    const m = medio()
    const { s, x, y } = st.current
    gesto.current = { tipo: 'pinch', d0: m.d || 1, s0: s, ax: (m.x - x) / s, ay: (m.y - y) / s }
  }
  const iniciarArrastre = (e) => {
    gesto.current = {
      tipo: 'arrastre', x0: e.clientX, y0: e.clientY, sx0: st.current.x, sy0: st.current.y, hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    }
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    detener()
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punteros.current.size === 1) {
      gesto.current = { tipo: 'pendiente', x0: e.clientX, y0: e.clientY }
      suprimirClick.current = false
    } else if (punteros.current.size === 2) {
      clearTimeout(tapPendiente.current)
      tapPendiente.current = null
      iniciarPinch()
    }
  }

  const onPointerMove = (e) => {
    const p = punteros.current.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    const g = gesto.current
    if (!g) return
    const { cw, ch, w, h } = dim.current

    if (g.tipo === 'pendiente') {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < UMBRAL_ARRASTRE) return
      try { contenedor.current.setPointerCapture(e.pointerId) } catch { /* puntero ya liberado */ }
      clearTimeout(tapPendiente.current)
      iniciarArrastre(e)
      return
    }

    if (g.tipo === 'arrastre' && punteros.current.size === 1) {
      const { s } = st.current
      const [lx, hx] = limitesEje(cw, w, s, reservaDerecha)
      const [ly, hy] = limitesEje(ch, h, s)
      st.current = {
        s,
        x: elastico(g.sx0 + (e.clientX - g.x0), lx, hx),
        y: elastico(g.sy0 + (e.clientY - g.y0), ly, hy),
      }
      g.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
      if (g.hist.length > 6) g.hist.shift()
      programar()
      return
    }

    if (g.tipo === 'pinch' && punteros.current.size === 2) {
      const m = medio()
      const { fit, max } = lim.current
      let sc = g.s0 * (m.d / g.d0)
      // Fuera de rango tira con resistencia y vuelve al soltar.
      if (sc < fit) sc = fit - Math.min((fit - sc) * 0.5, fit * 0.18)
      else if (sc > max) sc = max + Math.min((sc - max) * 0.25, max * 0.25)
      const [lx, hx] = limitesEje(cw, w, sc, reservaDerecha)
      const [ly, hy] = limitesEje(ch, h, sc)
      st.current = {
        s: sc,
        x: elastico(m.x - g.ax * sc, lx, hx),
        y: elastico(m.y - g.ay * sc, ly, hy),
      }
      programar()
    }
  }

  const onPointerUp = (e) => {
    if (!punteros.current.has(e.pointerId)) return
    const antes = punteros.current.size
    const g = gesto.current
    punteros.current.delete(e.pointerId)

    if (g?.tipo === 'pendiente' && antes === 1) {
      if (e.type === 'pointercancel') {
        gesto.current = null
        return
      }
      // Tap. El click (si cae sobre una unidad) lo difiere el listener en
      // captura; acá solo se detecta el doble tap.
      const ahora = e.timeStamp
      const prev = ultimoTap.current
      const p = local(e)
      if (ahora - prev.t < DOBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOBLE_TAP_PX) {
        ultimoTap.current = { t: 0, x: 0, y: 0 }
        suprimirClick.current = true
        setTimeout(() => { suprimirClick.current = false }, 80)
        clearTimeout(tapPendiente.current)
        tapPendiente.current = null
        const { s } = st.current
        const { fit, max } = lim.current
        if (s >= max * 0.9) animar(encuadrado(), 300)
        else zoomEn(p.x, p.y, Math.min(max, Math.max(s * 2, fit * 2)), 280)
      } else {
        ultimoTap.current = { t: ahora, x: e.clientX, y: e.clientY }
      }
      gesto.current = null
      return
    }

    if (g?.tipo === 'arrastre' || g?.tipo === 'pinch') {
      suprimirClick.current = true
      setTimeout(() => { suprimirClick.current = false }, 80)
    }

    if (punteros.current.size === 1 && g?.tipo === 'pinch') {
      // Se levantó un dedo del pinch: el otro sigue como arrastre, sin salto.
      const [resto] = [...punteros.current.entries()]
      iniciarArrastre({ clientX: resto[1].x, clientY: resto[1].y, timeStamp: e.timeStamp })
      return
    }
    if (punteros.current.size > 0) return

    if (g?.tipo === 'arrastre') {
      const h = g.hist
      const a = h[0]
      const b = h[h.length - 1]
      const dt = b.t - a.t
      gesto.current = null
      if (dt > 0 && dt < 120 && !reducido()) {
        const vx = (b.x - a.x) / dt
        const vy = (b.y - a.y) / dt
        // Si quedó afuera del rango (rebote), primero vuelve; si no, inercia.
        const { s, x, y } = st.current
        const dentro = valido(s, x, y)
        if (dentro.x === x && dentro.y === y && Math.hypot(vx, vy) > 0.15) {
          inercia(vx, vy)
          return
        }
      }
    }
    gesto.current = null
    asentar()
  }

  const asignarContenedor = useCallback((node) => {
    contenedor.current = node
    if (slideRef) slideRef.current = node
  }, [slideRef])

  return (
    <div
      ref={asignarContenedor}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onAnimationEnd={onAnimationEnd}
      style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      className={`flex-1 min-h-0 overflow-hidden relative ${className}`}
      data-zoom-pan
    >
      <div
        ref={contenido}
        className="absolute top-0 left-0 flex flex-col items-center select-none"
        style={{ transformOrigin: '0 0', willChange: 'transform', visibility: 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
})

export default ZoomPanPinch

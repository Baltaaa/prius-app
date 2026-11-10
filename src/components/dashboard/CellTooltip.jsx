import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

// Tooltip de unidad del Plano (nov 2026) — portal a document.body.
//
// Antes vivía dentro de la celda (`absolute bottom-full`), o sea dentro del
// contenedor del plano, que tiene `overflow` y el `transform` del zoom: con
// zoom el cartel quedaba cortado contra el borde del mapa, y en las unidades
// de los bordes (carpas 1, 25, 26, 122, 144; sombrillas 1 y 40) no se leía.
//
// Acá sale del contenedor: `position: fixed` calculada con
// getBoundingClientRect() de la celda, y z-index por encima de la zona
// sticky (z-20), el sidebar y los controles de zoom (z-10) — pero por debajo
// de los overlays de la app (997-999), que son los que SÍ deben taparlo.
//
// La posición se recalcula en un loop de rAF mientras el tooltip está
// visible: el zoom y el pan son `transform` y no disparan ningún evento
// (scroll/resize no alcanzan), así que medir cada frame es la única forma de
// no quedar desfasado. Corre solo mientras hay un cartel abierto (uno a la
// vez, es hover), y solo setea estado si la posición cambió de verdad.
//
// Flip/shift: por default arriba y centrado; si no entra arriba, abajo; y
// siempre corrido en horizontal para quedar completo dentro del viewport.
// El contenido, los textos y el estilo del cartel no cambian: solo dónde y
// cómo se posiciona.

const MARGEN = 8   // aire mínimo contra el borde del viewport
const GAP = 12     // separación contra la celda (equivalente al mb-3 de antes)
const ANCHO = 208  // w-52 — mismo ancho de siempre

export default function CellTooltip({ anchorRef, children }) {
  const [pos, setPos] = useState(null)
  const cajaRef = useRef(null)
  const ultimaRef = useRef({ top: -1, left: -1 })

  useLayoutEffect(() => {
    let frame = 0

    const medir = () => {
      const ancla = anchorRef.current
      if (ancla) {
        const r = ancla.getBoundingClientRect()
        const alto = cajaRef.current?.offsetHeight ?? 0
        const vw = window.innerWidth
        const vh = window.innerHeight

        // Vertical: arriba por default; abajo si no entra arriba.
        const arriba = r.top - GAP - alto
        const abajo = r.bottom + GAP
        const cabeArriba = arriba >= MARGEN
        const cabeAbajo = abajo + alto <= vh - MARGEN
        let top = cabeArriba || !cabeAbajo ? arriba : abajo
        // Si no entra de ningún lado (zoom máximo en una pantalla baja), se
        // pega al borde que tenga lugar antes de salirse.
        top = Math.min(Math.max(top, MARGEN), Math.max(MARGEN, vh - alto - MARGEN))

        // Horizontal: centrado en la celda y corrido lo justo para entrar.
        let left = r.left + r.width / 2 - ANCHO / 2
        left = Math.min(Math.max(left, MARGEN), Math.max(MARGEN, vw - ANCHO - MARGEN))

        const ultima = ultimaRef.current
        if (Math.abs(ultima.top - top) > 0.5 || Math.abs(ultima.left - left) > 0.5) {
          ultimaRef.current = { top, left }
          setPos({ top, left })
        }
      }
      frame = requestAnimationFrame(medir)
    }

    medir()
    return () => cancelAnimationFrame(frame)
  }, [anchorRef])

  return createPortal(
    <div
      ref={cajaRef}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: ANCHO,
        zIndex: 996,
        // Hasta la primera medición no se pinta: evita el salto desde 0,0.
        visibility: pos ? "visible" : "hidden",
      }}
      className="pointer-events-none"
    >
      {children}
    </div>,
    document.body,
  )
}

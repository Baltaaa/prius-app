import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ToolbarSlotContext } from './toolbarSlot'

// Controles propios de una página dentro de la barra única (ver PageTopbar.jsx
// y AppLayout.jsx). Cada sección envuelve sus controles en <ToolbarSticky> y
// quedan montados DENTRO de la barra: en desktop en el medio de la fila de
// 64px, en mobile en la fila de pills debajo del título — siempre la misma
// pieza flotante, con una sola capa de blur.
//
// Los controles van SIEMPRE en una sola línea de 40px: si no entran,
// scrollean en horizontal sin barra visible y con fade en los bordes que
// tienen contenido oculto (nunca una segunda fila).
//
// Los handlers y refs de la toolbar siguen siendo los de la página (es un
// portal: el árbol de React no cambia). Fuera del AppLayout (tests, vistas
// sueltas) no hay slot: se renderiza en el lugar, como cualquier div.
function FilaControles({ children, className = '' }) {
  const ref = useRef(null)
  const [bordes, setBordes] = useState({ izq: false, der: false })

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    const izq = el.scrollLeft > 1
    const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setBordes((p) => (p.izq === izq && p.der === der ? p : { izq, der }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    for (const hijo of el.children) ro.observe(hijo)
    return () => {
      el.removeEventListener('scroll', medir)
      ro.disconnect()
    }
  }, [medir, children])

  const mask = bordes.izq || bordes.der
    ? `linear-gradient(to right, ${bordes.izq ? 'transparent 0, black 24px' : 'black 0'}, ${bordes.der ? 'black calc(100% - 24px), transparent 100%' : 'black 100%'})`
    : undefined

  return (
    <div
      ref={ref}
      className={`toolbar-fila ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  )
}

export default function ToolbarSticky({ children, className = '' }) {
  const slot = useContext(ToolbarSlotContext)
  const fila = <FilaControles className={className}>{children}</FilaControles>
  if (slot === undefined) return fila
  return slot ? createPortal(fila, slot) : null
}

import { forwardRef, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ScrollFade from './ScrollFade'

// Popover anclado en portal a document.body, con position: fixed calculada
// desde el rect del ancla. Es el único mecanismo para dropdowns/popovers que
// nacen dentro de la zona sticky (ProgressiveBlurHeader): un `absolute` ahí
// hereda su mask-image, overflow y stacking, y queda cortado o tapado.
//
// - Siempre se abre HACIA ABAJO: top = bottom del ancla + `offset`. Nunca flip.
// - `align="left"` alinea al borde izquierdo del ancla, `"right"` al derecho.
// - `matchWidth`: ancho = ancho del ancla (con mínimo `minWidth`); si no,
//   `width` fijo. Siempre se clampa para entrar en el viewport.
// - Se recalcula en resize y en scroll (captura, cualquier contenedor).
// - max-height = 100dvh - top - 16px; con `scroll` el contenido scrollea por
//   dentro con ScrollFade. Con `scroll={false}` el hijo se encarga del scroll.
// - `panelRef` recibe el nodo del panel (para `useOverlay().bind`); el resto de
//   las props (handlers de hover, role, aria-*) van al panel.
const MARGEN = 16
const Z_POPOVER = 80 // por encima de la zona sticky (z-20), debajo de modales (997+)

const PopoverAnclado = forwardRef(function PopoverAnclado(
  {
    anchorRef, align = 'left', matchWidth = false, width = 320, minWidth = 0, offset = 8,
    scroll = true, className = '', children, ...rest
  },
  panelRef,
) {
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const calcular = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const vw = document.documentElement.clientWidth
      const ancho = Math.min(matchWidth ? Math.max(rect.width, minWidth) : width, vw - MARGEN * 2)
      const izq = align === 'right' ? rect.right - ancho : rect.left
      const left = Math.max(MARGEN, Math.min(izq, vw - ancho - MARGEN))
      const top = rect.bottom + offset
      setPos((p) => (p && p.top === top && p.left === left && p.width === ancho ? p : { top, left, width: ancho }))
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('scroll', calcular, true)
    }
  }, [anchorRef, align, matchWidth, width, minWidth, offset])

  if (!pos) return null
  return createPortal(
    <div
      ref={panelRef}
      data-popover-anclado
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: `calc(100dvh - ${pos.top}px - ${MARGEN}px)`, zIndex: Z_POPOVER }}
      className={`surface-pop ui-open flex flex-col overflow-hidden ${className}`}
      {...rest}
    >
      {scroll ? (
        <ScrollFade wrapperClassName="flex-1 min-h-0" className="overflow-y-auto">{children}</ScrollFade>
      ) : children}
    </div>,
    document.body,
  )
})

export default PopoverAnclado

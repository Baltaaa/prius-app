import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'

// Difuminado de scroll: componente único para TODO contenedor con scroll
// interno (fichas, listas, Historial, sheets, modales). Cuando queda contenido
// oculto arriba o abajo, ese borde se desvanece a transparente (mask-image) y
// una capa con blur suave (backdrop-filter) lo acompaña, así nunca hay un
// corte seco. Solo aparece en la dirección donde hay contenido oculto y se va
// al llegar al final. El fade va a transparente, no a un color: funciona
// sobre cualquier fondo. Es la única excepción a "sin gradientes": funcional,
// no decorativo.
//
// Estructura: <wrapper relative> <scroller> + capas de blur absolutas </wrapper>.
// Las capas son hermanas del scroller (no hijas) para no alterar su layout
// (flex, grid, gap, space-y) ni scrollear con el contenido.
//
// Uso: el div que antes scrolleaba pasa a ser <ScrollFade>.
//   - `className`: clases del SCROLLER (overflow, padding, gap, display...).
//   - `wrapperClassName`: clases de LAYOUT de la caja (flex-1, max-h-*, h-full,
//     absolute, w-*, surface-pop...). El wrapper es una columna flex con
//     min-h-0 y overflow-hidden; el scroller es flex-1 min-h-0.
//   - `arriba={false}`: sin difuminado arriba (tablas con encabezado sticky).
// `as` permite otra etiqueta para el scroller. El ref expone el scroller.
//
// Costo: el backdrop-filter se había sacado del proyecto por rendimiento (ver
// CLAUDE.md). Acá cada capa mide 24px, se monta solo mientras hay contenido
// oculto en esa dirección y nunca hay más de dos por contenedor.
const FADE = 24 // px de difuminado — sutil

/** @type {import('react').ForwardRefExoticComponent<Record<string, any> & import('react').RefAttributes<any>>} */
const ScrollFade = forwardRef(function ScrollFade(
  { as: Tag = 'div', className = '', wrapperClassName = '', style, arriba: conArriba = true, children, ...rest },
  ref,
) {
  const innerRef = useRef(null)
  useImperativeHandle(ref, () => innerRef.current, [])
  const [{ arriba, abajo }, setSombras] = useState({ arriba: false, abajo: false })

  const recalcular = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    // 1px de tolerancia: scrollHeight/scrollTop son fraccionarios con zoom
    // del browser o alturas en rem, y sin esto el fade de abajo nunca
    // terminaba de apagarse al llegar al final.
    const siguiente = { arriba: scrollTop > 1, abajo: scrollTop + clientHeight < scrollHeight - 1 }
    // Mismo valor: no re-renderiza en cada evento de scroll.
    setSombras((prev) => (prev.arriba === siguiente.arriba && prev.abajo === siguiente.abajo ? prev : siguiente))
  }, [])

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    recalcular()
    el.addEventListener('scroll', recalcular, { passive: true })
    // El contenido puede cambiar de alto sin que haya scroll (filtrar una
    // lista, abrir un acordeón): hay que recalcular igual.
    const ro = new ResizeObserver(recalcular)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', recalcular)
      ro.disconnect()
    }
  }, [recalcular])

  const verArriba = conArriba && arriba
  const desde = verArriba ? `transparent 0, black ${FADE}px` : 'black 0'
  const hasta = abajo ? `black calc(100% - ${FADE}px), transparent 100%` : 'black 100%'
  const mask = verArriba || abajo ? `linear-gradient(to bottom, ${desde}, ${hasta})` : undefined

  return (
    <div className={`relative flex flex-col min-h-0 overflow-hidden ${wrapperClassName}`}>
      <Tag
        ref={innerRef}
        className={`flex-1 min-h-0 ${className}`}
        style={{ ...style, maskImage: mask, WebkitMaskImage: mask }}
        {...rest}
      >
        {children}
      </Tag>
      {verArriba && <span aria-hidden className="scroll-blur scroll-blur-arriba" />}
      {abajo && <span aria-hidden className="scroll-blur scroll-blur-abajo" />}
    </div>
  )
})

export default ScrollFade

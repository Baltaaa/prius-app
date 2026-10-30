import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'

// Indicador de profundidad para cualquier contenedor con scroll vertical
// (30/10/2026). Difumina el contenido contra el fondo arriba cuando ya se
// scrolleó y abajo cuando queda más para ver; al llegar al final el de abajo
// desaparece. Así se nota de un vistazo que una lista/modal sigue.
//
// Se resuelve con `mask-image` sobre el propio contenedor que scrollea, no
// con overlays absolutos: no agrega nodos, no tapa clicks y funciona sobre
// cualquier fondo (el fade va a transparente, no a un color hardcodeado).
// Es la única excepción a "sin gradientes" de CLAUDE.md — es funcional, no
// decorativo.
//
// Uso: reemplazar el div que scrollea.
//   <ScrollFade className="overflow-y-auto max-h-64"> ... </ScrollFade>
// `as` permite usar otra etiqueta (ul, section, etc.). El ref expone el nodo
// real por si el caller necesita medir o scrollear.
const FADE = 24 // px de difuminado — sutil, acorde a "Quiet Luxury"

const ScrollFade = forwardRef(function ScrollFade(
  { as: Tag = 'div', className = '', style, children, ...rest },
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
    setSombras({
      arriba: scrollTop > 1,
      abajo: scrollTop + clientHeight < scrollHeight - 1,
    })
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

  const desde = arriba ? `transparent 0, black ${FADE}px` : 'black 0'
  const hasta = abajo ? `black calc(100% - ${FADE}px), transparent 100%` : 'black 100%'
  const mask = arriba || abajo ? `linear-gradient(to bottom, ${desde}, ${hasta})` : undefined

  return (
    <Tag
      ref={innerRef}
      className={className}
      style={{ ...style, maskImage: mask, WebkitMaskImage: mask }}
      {...rest}
    >
      {children}
    </Tag>
  )
})

export default ScrollFade

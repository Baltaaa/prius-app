import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp } from 'lucide-react'

// Botón flotante "volver arriba" — escucha el scroll del <main> de
// AppLayout.jsx (#app-main-scroll), no window: ese <main>, no el documento,
// es el contenedor con scroll real en esta app (ver AppLayout.jsx). Aparece
// recién después de SHOW_AFTER px para no competir con el header en
// pantallas cortas de contenido. En mobile se levanta por encima del
// BottomNav fijo (56px + safe-area).
//
// Portal a document.body: el root de cada página (ej. "animate-premium-fade"
// en Clientes.jsx) tiene su propia animación con `transform`, que crea un
// nuevo containing block para `position: fixed` — sin portal, el botón queda
// "fixed" relativo a ese contenedor transformado en vez del viewport, y
// termina posicionado miles de píxeles fuera de pantalla (mismo motivo por
// el que Modal.jsx ya usa un portal, ver su comentario).
const SHOW_AFTER = 600

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const el = document.getElementById('app-main-scroll')
    containerRef.current = el
    if (!el) return
    const onScroll = () => setVisible(el.scrollTop > SHOW_AFTER)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const handleClick = () => {
    const el = containerRef.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return createPortal(
    <button
      type="button"
      onClick={handleClick}
      aria-label="Volver arriba"
      className={`fixed right-4 md:right-8 md:bottom-6 z-40 w-11 h-11 rounded-full bg-[#F2CA50] text-black
                  flex items-center justify-center transition-opacity duration-300
                  bottom-[calc(56px+env(safe-area-inset-bottom)+16px)]
                  ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <ArrowUp size={20} />
    </button>,
    document.body,
  )
}

import { useEffect, useState } from 'react'

// Alto que le roba el teclado en pantalla al layout viewport (iOS Safari no
// lo achica). Se usa como padding inferior de los overlays anclados abajo para
// que el input activo quede siempre sobre el teclado. 0 sin teclado.
export function useKeyboardInset(activo = true) {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!activo || !vv) return undefined
    const medir = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    medir()
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir) }
  }, [activo])
  return inset
}

// Al enfocar un campo adentro de un sheet, lo centra en el área visible.
export function centrarCampoEnfocado(e) {
  const el = e.target
  if (!(el instanceof HTMLElement) || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
}

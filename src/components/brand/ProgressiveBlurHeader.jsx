import { forwardRef } from 'react'

// Zona sticky superior flotante (topbar + toolbar de la sección). El contenido
// de la página scrollea POR DEBAJO: el fondo es un degradé del color canvas al
// 80% de opacidad hasta transparente, más un blur progresivo (fuerte arriba,
// cero en el borde inferior) hecho con capas de backdrop-filter de intensidad
// creciente, cada una con su máscara en degradé. Reglas en index.css
// (`.pbh-*`). Sin soporte de backdrop-filter queda solo el degradé; con
// "reducir transparencia" del sistema también.
//
// Única implementación: AppLayout monta una sola, con la Topbar y el slot de
// las toolbars de sección adentro. Ver DESIGN.md "Zona sticky superior".
//
// `className` trae el posicionamiento (absolute top-0 inset-x-0 z-20): el
// componente no decide dónde vive, solo cómo se ve su fondo.
const ProgressiveBlurHeader = forwardRef(function ProgressiveBlurHeader({ className = '', children }, ref) {
  return (
    <div ref={ref} className={`pbh ${className}`}>
      <div aria-hidden className="pbh-fondo">
        <span className="pbh-capa pbh-capa-1" />
        <span className="pbh-capa pbh-capa-2" />
        <span className="pbh-capa pbh-capa-3" />
        <span className="pbh-capa pbh-capa-4" />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
})

export default ProgressiveBlurHeader

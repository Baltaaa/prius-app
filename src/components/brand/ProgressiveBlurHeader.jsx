import { forwardRef } from 'react'

// Zona sticky superior flotante: UNA barra por página (PageTopbar) con el
// contenido scrolleando por debajo. El fondo es SOLO backdrop-filter
// (blur 20px + saturate 160%), sin color ni tinte en ninguno de los dos
// temas, sin borde ni sombra; se extiende 40px por debajo con una máscara en
// degradé para difuminarse de a poco en vez de cortar seco. Reglas en
// index.css (`.pbh-fondo`). Sin soporte de backdrop-filter —o con "reducir
// transparencia" del sistema— cae a fondo canvas sólido, que es lo único que
// mantiene el texto legible.
//
// Una sola capa de blur por página, por rendimiento: ninguna barra anidada
// lleva backdrop-filter propio. Única implementación: AppLayout monta una.
// Ver DESIGN.md "Zona sticky superior".
//
// `className` trae el posicionamiento (absolute top-0 inset-x-0 z-20): el
// componente no decide dónde vive, solo cómo se ve su fondo.
const ProgressiveBlurHeader = forwardRef(function ProgressiveBlurHeader({ className = '', children }, ref) {
  return (
    <div ref={ref} className={`pbh ${className}`}>
      <div aria-hidden className="pbh-fondo" />
      <div className="relative">{children}</div>
    </div>
  )
})

export default ProgressiveBlurHeader

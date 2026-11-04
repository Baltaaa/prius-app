import { Expand, Minus, Plus, Scan, Shrink } from 'lucide-react'

// Controles de zoom del Plano mobile: UNA pill vertical flotante (reemplaza
// la columna de botones sueltos). Botones de 40px con área táctil de 44px
// (el botón mide 44px y adentro va el círculo de 40px), fondo blanco con
// borde, ícono de 18px. Se posiciona dentro del padding de la card (mismo
// inset que el resto del contenido). "Encuadrar" vuelve al zoom mínimo,
// centrado.
export default function PlanoZoomPill({ onZoomIn, onZoomOut, onEncuadrar, fullscreen, onToggleFullscreen, className = '' }) {
  // Área táctil de 44px; lo que se ve (hover/activo) es un círculo de 40px.
  const btn = 'group w-11 h-11 min-h-0 flex items-center justify-center text-ink'
  const disco = 'w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-surface group-active:bg-surface transition-colors'
  return (
    <div className={`flex flex-col items-center rounded-full bg-card border border-line ${className}`}>
      <button type="button" onClick={onZoomIn} className={btn} title="Acercar" aria-label="Acercar">
        <span className={disco}><Plus size={18} /></span>
      </button>
      <button type="button" onClick={onZoomOut} className={btn} title="Alejar" aria-label="Alejar">
        <span className={disco}><Minus size={18} /></span>
      </button>
      <button type="button" onClick={onEncuadrar} className={btn} title="Encuadrar" aria-label="Encuadrar">
        <span className={disco}><Scan size={18} /></span>
      </button>
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={btn}
          title={fullscreen ? 'Cerrar pantalla completa' : 'Ver en pantalla completa'}
          aria-label={fullscreen ? 'Cerrar pantalla completa' : 'Ver en pantalla completa'}
        >
          <span className={disco}>{fullscreen ? <Shrink size={18} /> : <Expand size={18} />}</span>
        </button>
      )}
    </div>
  )
}

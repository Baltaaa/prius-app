import { Expand, Minus, Plus, RotateCw, Scan, Shrink } from "lucide-react"

// Controles de zoom del Plano (Fase 6A: pasaron a la carpeta portable; antes
// dashboard/PlanoZoomBar.jsx y dashboard/PlanoZoomPill.jsx). Los usan la vista
// normal del Plano del CRM, el modal "vista clientes" y la landing.
//
// Colores: en claro, valores fijos (los tokens del CRM en tema claro); las
// variantes `dark:` solo se activan en el CRM y leen sus variables.

// Columna al lado del mapa (desktop/tablet), en el flujo del layout: nunca se
// superpone a una celda. +, −, Encuadrar, Rotar (opcional) y `extraButtons`.
export function BarraZoomPlano({ onZoomIn, onZoomOut, onEncuadrar, onRotar, rotado = false, extraButtons }) {
  const btnClass = "w-11 h-11 md:w-9 md:h-9 rounded-[12px] bg-[#F2F1EC] text-black dark:bg-[rgb(var(--secondary))] dark:text-[rgb(var(--primary))] flex items-center justify-center transition-colors shrink-0"
  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button onClick={onZoomIn} className={btnClass} title="Acercar">
        <Plus size={16} />
      </button>
      <button onClick={onZoomOut} className={btnClass} title="Alejar">
        <Minus size={16} />
      </button>
      <button onClick={onEncuadrar} className={btnClass} title="Encuadrar">
        <Scan size={14} />
      </button>
      {onRotar && (
        <button onClick={onRotar} className={btnClass} title="Rotar el plano 180°" aria-label="Rotar el plano 180°" aria-pressed={rotado}>
          <RotateCw size={16} />
        </button>
      )}
      {extraButtons}
    </div>
  )
}

// Mobile: UNA pill vertical flotante. Área táctil de 44px; lo que se ve
// (hover/activo) es un círculo de 40px. "Encuadrar" vuelve al zoom mínimo,
// centrado. `onToggleFullscreen`: abrir (Expand) o cerrar (Shrink) la vista
// clientes, según `fullscreen`.
export function PillZoomPlano({ onZoomIn, onZoomOut, onEncuadrar, onRotar, rotado = false, fullscreen, onToggleFullscreen, className = "" }) {
  const btn = "group w-11 h-11 min-h-0 flex items-center justify-center text-black dark:text-[rgb(var(--primary))]"
  const disco = "w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-[#F2F1EC] group-active:bg-[#F2F1EC] dark:group-hover:bg-[rgb(var(--secondary))] dark:group-active:bg-[rgb(var(--secondary))] transition-colors"
  return (
    <div className={`flex flex-col items-center rounded-full bg-white border border-[#E5E5E5] dark:bg-[rgb(var(--card))] dark:border-[rgb(var(--border)_/_var(--border-a))] ${className}`}>
      <button type="button" onClick={onZoomIn} className={btn} title="Acercar" aria-label="Acercar">
        <span className={disco}><Plus size={18} /></span>
      </button>
      <button type="button" onClick={onZoomOut} className={btn} title="Alejar" aria-label="Alejar">
        <span className={disco}><Minus size={18} /></span>
      </button>
      <button type="button" onClick={onEncuadrar} className={btn} title="Encuadrar" aria-label="Encuadrar">
        <span className={disco}><Scan size={18} /></span>
      </button>
      {onRotar && (
        <button type="button" onClick={onRotar} className={btn} title="Rotar el plano 180°" aria-label="Rotar el plano 180°" aria-pressed={rotado}>
          <span className={disco}><RotateCw size={18} /></span>
        </button>
      )}
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={btn}
          title={fullscreen ? "Cerrar pantalla completa" : "Ver en pantalla completa"}
          aria-label={fullscreen ? "Cerrar pantalla completa" : "Ver en pantalla completa"}
        >
          <span className={disco}>{fullscreen ? <Shrink size={18} /> : <Expand size={18} />}</span>
        </button>
      )}
    </div>
  )
}

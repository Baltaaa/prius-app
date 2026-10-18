import { Plus, Minus, Scan } from "lucide-react"

// Controles de zoom del Plano, FUERA de PlanoViewport.jsx (congelado — ver
// CLAUDE.md "Plano portable"). PlanoViewport ya trae su propia barra de
// zoom flotante encima del mapa (absolute top-6 right-6), pero esa queda
// ocultada desde afuera (`[&>div:first-child]:hidden` en el wrapper que la
// monta, ver Dashboard.jsx/PlanoMobile.jsx) y se reemplaza por esta barra:
// vive en el flujo normal del layout (no absoluta), así nunca se superpone
// a una celda ni al texto de sincronización — llama a las mismas
// `onZoomIn`/`onZoomOut`/`onEncuadrar` que ya calcula Dashboard.jsx.
export default function PlanoZoomBar({ onZoomIn, onZoomOut, onEncuadrar, extraButtons }) {
  const btnClass = "w-9 h-9 rounded-lg bg-prius-subtle hover:bg-[#EEEEEE] text-black flex items-center justify-center transition-colors shrink-0"
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
      {extraButtons}
    </div>
  )
}

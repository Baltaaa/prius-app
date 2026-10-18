import { memo } from "react"
import { Hourglass, Clock } from "lucide-react"
import { STATUS } from "./constants"

// Celda del Plano mobile (<768px, oct 2026) — componente NUEVO y separado de
// Cell.jsx (el de desktop/tablet, congelado por tarea): mismo `unit` enriquecido
// que ya arma Dashboard.jsx (buildUnitsMap), pero con tamaño táctil real (min
// 44x36, nunca escalado) y un esquema de 3 colores de fondo en vez de los 6
// colores/variantes de Cell.jsx — ver mapeo abajo.
//
// Mapeo elegido (reporta al dueño en el mensaje de la tarea, no inventado a
// ciegas): el pedido original da 3 colores fijos — libre blanco, "ocupada"
// negro, "pendiente de pago" dorado #F2CA50. Cell.jsx hoy no tiene un color
// de fondo dedicado a "con saldo pendiente": lo que sí tiene es `isPaid`
// (reserva.estado_pago === 'pagado') para CUALQUIER tipo ocupado. Entonces:
//   - libre                                  → blanco, borde hairline
//   - pendiente_confirmacion (⏳, sin precio) → blanco + ícono reloj de arena
//     (mismo color que libre en Cell.jsx — el reloj es el único
//     diferenciador ahí también, no se inventa un 4to color)
//   - ocupada (temporada/período/día) + pagada  → negro, marca T/P/D
//   - ocupada (temporada/período/día) + con saldo → dorado, marca T/P/D
// El punto verde de Cell.jsx queda REDUNDANTE acá (el negro ya significa
// "pagada") — se omite a propósito, no es un descarte accidental.
// El reloj chico (preconfirmada web) se mantiene como marca independiente,
// se puede combinar con cualquiera de los 3 fondos.
function CellMobile({ number, unit, onClick, isHighlighted, isDimmed }) {
  const status = unit?.status || STATUS.LIBRE
  const isPendienteConfirmacion = status === STATUS.PENDIENTE_CONFIRMACION
  const isTemporada = status === STATUS.TEMPORADA
  const isPeriodo = status === STATUS.PERIODO
  const isDia = status === STATUS.DIA
  const isOcupada = isTemporada || isPeriodo || isDia
  const letra = isTemporada ? "T" : isPeriodo ? "P" : isDia ? "D" : null

  const bgClass = isPendienteConfirmacion || !isOcupada
    ? "bg-white border border-hairline text-black"
    : unit?.isPaid
      ? "bg-black border border-black text-white"
      : "bg-[#F2CA50] border border-[#F2CA50] text-black"

  const opacityClass = isDimmed ? "opacity-30" : "opacity-100"
  const highlightClass = isHighlighted ? "ring-2 ring-gold scale-105 z-10" : ""

  return (
    <button
      data-deeplink-id={unit?.dbId}
      onClick={() => onClick(unit)}
      className={`relative w-11 h-9 min-w-[44px] min-h-[36px] shrink-0 rounded-md flex items-center justify-center font-semibold text-[13px] tabular-nums transition-colors ${bgClass} ${opacityClass} ${highlightClass}`}
    >
      {number}

      {isPendienteConfirmacion && (
        <Hourglass size={12} className="absolute top-0.5 right-0.5 text-prius-slate" />
      )}
      {letra && !isPendienteConfirmacion && (
        <span className="absolute top-0 right-0.5 text-[10px] font-bold leading-none">{letra}</span>
      )}
      {unit?.esPreconfirmadaWeb && (
        <Clock size={10} className="absolute -bottom-0.5 -right-0.5 text-current opacity-90" />
      )}
    </button>
  )
}

export default memo(CellMobile)

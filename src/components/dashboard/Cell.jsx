import { memo, useState } from "react"
import { STATUS } from "./constants"

// 184 celdas montadas a la vez en el Plano. React.memo evita re-renderizarlas
// todas cuando cambia el zoom o se abre un modal, y `transition-colors` en vez
// de `transition-all` evita que el navegador anime layout/box-shadow de 184
// elementos en paralelo.
function Cell({ number, unit, onClick, isHighlighted, isDimmed }) {
  const status = unit?.status || STATUS.LIBRE
  const isTemporada = status === STATUS.TEMPORADA
  const isPeriodo = status === STATUS.PERIODO
  const [showTooltip, setShowTooltip] = useState(false)

  const styles = isTemporada
    ? "bg-[#FDE047] text-black border-[#FDE047]"
    : isPeriodo
      ? "bg-white/20 text-white border-white/30"
      : "bg-white/5 text-white/20 border-white/10 hover:border-white/30"

  const opacityClass = isDimmed ? "opacity-20" : "opacity-100"
  const highlightClass = isHighlighted
    ? "ring-2 ring-[#FDE047] scale-105 z-10 shadow-[0_0_15px_rgba(253,224,71,0.3)]"
    : ""

  return (
    <div
      className="flex items-center relative"
      onMouseEnter={() => unit?.clientName && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="w-5 md:w-6 text-[9px] font-bold text-white/30 text-right pr-1.5">{number}</span>
      <button
        onClick={() => onClick(unit)}
        className={`w-6 h-4.5 md:w-7 md:h-5 text-[9px] font-bold flex flex-col items-center justify-center border rounded-sm cursor-pointer transition-colors relative ${styles} ${opacityClass} ${highlightClass}`}
      >
        <span className="leading-none">
          {isTemporada && "T"}
          {isPeriodo && "P"}
        </span>
        {unit?.isPaid && (status === STATUS.TEMPORADA || status === STATUS.PERIODO) && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && unit?.clientName && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 glass-card text-white text-[11px] p-4 rounded-xl shadow-2xl z-50 pointer-events-none border border-white/20">
          <p className="font-bold uppercase tracking-wider text-[#FDE047] mb-2">{unit.clientName}</p>
          <div className="space-y-1 opacity-80 font-medium">
            {unit.isTemporada ? (
              <p>Temporada Completa</p>
            ) : (
              <p>{unit.startDate} al {unit.endDate}</p>
            )}
            <p className={`font-bold mt-2 ${unit.isPaid ? 'text-green-400' : 'text-red-400'}`}>
              {unit.isPaid ? "PAGADO" : "PAGO PENDIENTE"}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(Cell)

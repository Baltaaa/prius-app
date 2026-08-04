import { useState } from "react"
import { STATUS } from "./constants"

export default function Cell({ number, unit, onClick, isHighlighted, isDimmed }) {
  const status = unit?.status || STATUS.LIBRE
  const isTemporada = status === STATUS.TEMPORADA
  const isPeriodo = status === STATUS.PERIODO
  const [showTooltip, setShowTooltip] = useState(false)
  
  const getBgColor = () => {
    if (isTemporada) return "bg-white text-black font-extrabold"
    if (isPeriodo) return "bg-[#F2CA50] text-black font-extrabold"
    return "bg-white/5 border border-white/10 text-white/30 hover:border-[#F2CA50]"
  }

  const opacityClass = isDimmed ? "opacity-20" : "opacity-100"
  const highlightClass = isHighlighted ? "ring-2 ring-offset-1 ring-[#F2CA50] scale-105 z-10" : ""
  
  return (
    <div 
      className="flex items-center relative"
      onMouseEnter={() => unit?.clientName && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="w-5 md:w-6 text-[8px] font-bold text-white/40 text-right pr-0.5">{number}</span>
      <button
        onClick={() => onClick(unit)}
        className={`w-6 h-4.5 md:w-7 md:h-5 text-[8px] font-bold flex flex-col items-center justify-center cursor-pointer transition-all relative rounded-sm ${getBgColor()} ${opacityClass} ${highlightClass}`}
      >
        <span className="leading-none">
          {isTemporada && "T"}
          {isPeriodo && "P"}
        </span>
        {unit?.isPaid && (status === STATUS.TEMPORADA || status === STATUS.PERIODO) && (
          <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-emerald-400" />
        )}
        {!unit?.isPaid && (status === STATUS.TEMPORADA || status === STATUS.PERIODO) && (
          <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-rose-500" />
        )}
      </button>

      {/* Tooltip Flotante */}
      {showTooltip && unit?.clientName && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#181818] text-white text-[10px] p-3 rounded-xl shadow-2xl z-50 pointer-events-none border border-white/10 backdrop-blur-md">
          <p className="font-bold uppercase tracking-wider text-[#F2CA50] mb-1">{unit.clientName}</p>
          {unit.isTemporada ? (
            <p className="opacity-80">Temporada Completa</p>
          ) : (
            <p className="opacity-80">{unit.startDate} al {unit.endDate}</p>
          )}
          {unit.notes && <p className="mt-1 border-t border-white/10 pt-1 italic opacity-60 truncate">{unit.notes}</p>}
          <p className={`mt-1 font-bold ${unit.isPaid ? 'text-emerald-400' : 'text-rose-400'}`}>
            {unit.isPaid ? "PAGADO" : "PAGO PENDIENTE"}
          </p>
        </div>
      )}
    </div>
  )
}
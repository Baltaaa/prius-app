import { useState } from "react"
import { STATUS } from "./constants"

export default function Cell({ number, unit, onClick, isHighlighted, isDimmed }) {
  const status = unit?.status || STATUS.LIBRE
  const isTemporada = status === STATUS.TEMPORADA
  const isPeriodo = status === STATUS.PERIODO
  const [showTooltip, setShowTooltip] = useState(false)
  
  const getBgColor = () => {
    if (isTemporada) return "bg-prius-black text-white"
    if (isPeriodo) return "bg-gold text-prius-black"
    return "bg-white text-prius-black/20"
  }

  const opacityClass = isDimmed ? "opacity-20" : "opacity-100"
  const highlightClass = isHighlighted ? "ring-2 ring-offset-1 ring-gold scale-105 z-10" : ""
  
  return (
    <div 
      className="flex items-center relative animate-premium-fade"
      onMouseEnter={() => unit?.clientName && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="w-6 md:w-8 text-[9px] font-bold text-prius-black/40 text-right pr-1">{number}</span>
      <button
        onClick={() => onClick(unit)}
        className={`w-7 h-6 md:w-9 md:h-7 text-[9px] font-bold flex flex-col items-center justify-center border border-hairline cursor-pointer hover:border-gold transition-all relative ${getBgColor()} ${opacityClass} ${highlightClass}`}
      >
        <span className="leading-none">
          {isTemporada && "T"}
          {isPeriodo && "P"}
        </span>
        {unit?.isPaid && (status === STATUS.TEMPORADA || status === STATUS.PERIODO) && (
          <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-green-500" />
        )}
        {!unit?.isPaid && (status === STATUS.TEMPORADA || status === STATUS.PERIODO) && (
          <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-red-500" />
        )}
      </button>

      {/* Tooltip Flotante */}
      {showTooltip && unit?.clientName && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-prius-black text-white text-[10px] p-3 rounded-sm shadow-lg z-50 pointer-events-none border border-hairline">
          <p className="font-bold uppercase tracking-wider text-gold mb-1">{unit.clientName}</p>
          {unit.isTemporada ? (
            <p className="opacity-80">Temporada Completa</p>
          ) : (
            <p className="opacity-80">{unit.startDate} al {unit.endDate}</p>
          )}
          {unit.notes && <p className="mt-1 border-t border-white/10 pt-1 italic opacity-60 truncate">{unit.notes}</p>}
          <p className={`mt-1 font-bold ${unit.isPaid ? 'text-green-400' : 'text-red-400'}`}>
            {unit.isPaid ? "PAGADO" : "PAGO PENDIENTE"}
          </p>
        </div>
      )}
    </div>
  )
}
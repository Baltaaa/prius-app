import { memo, useState } from "react"
import { Hourglass, Clock } from "lucide-react"
import { STATUS } from "./constants"
import { COLOR_TIPO_ALQUILER } from "../../lib/colors"

// 184 celdas montadas a la vez en el Plano. React.memo evita re-renderizarlas
// todas cuando cambia el zoom o se abre un modal, y `transition-colors` en vez
// de `transition-all` evita que el navegador anime layout/box-shadow de 184
// elementos en paralelo.
//
// 6 variantes visuales sin ambigüedad (sep 2026):
//   T amarillo + punto verde   → temporada saldada al 100%
//   T amarillo sin punto       → temporada confirmada, seña/parcial
//   ⏳ fondo blanco            → temporada pendiente_confirmacion (cliente de
//                                la temporada pasada, todavía sin confirmar)
//   celda vacía                → libre
//   P fondo oscuro             → período
//   D fondo gris claro         → día
function Cell({ number, unit, onClick, isHighlighted, isDimmed, numberSide = "left" }) {
  const status = unit?.status || STATUS.LIBRE
  const isPendienteConfirmacion = status === STATUS.PENDIENTE_CONFIRMACION
  const isTemporada = status === STATUS.TEMPORADA
  const isPeriodo = status === STATUS.PERIODO
  const isDia = status === STATUS.DIA
  const isOcupada = isTemporada || isPeriodo || isDia || isPendienteConfirmacion
  const [showTooltip, setShowTooltip] = useState(false)

  const styles = isPendienteConfirmacion
    ? "bg-white text-black border-white"
    : isTemporada
      ? `${COLOR_TIPO_ALQUILER.temporada.bg} ${COLOR_TIPO_ALQUILER.temporada.text} ${COLOR_TIPO_ALQUILER.temporada.border}`
      : isPeriodo
        ? `${COLOR_TIPO_ALQUILER.periodo.bg} ${COLOR_TIPO_ALQUILER.periodo.text} ${COLOR_TIPO_ALQUILER.periodo.border}`
        : isDia
          ? `${COLOR_TIPO_ALQUILER.dia.bg} ${COLOR_TIPO_ALQUILER.dia.text} ${COLOR_TIPO_ALQUILER.dia.border}`
          : "bg-white/5 text-white/20 border-white/10 hover:border-white/30"

  const opacityClass = isDimmed ? "opacity-20" : "opacity-100"
  const highlightClass = isHighlighted
    ? "ring-2 ring-[#FDE047] scale-105 z-10 shadow-[0_0_15px_rgba(253,224,71,0.3)]"
    : ""

  const numberLabel = (
    <span
      className={`w-5 md:w-6 text-[9px] font-bold text-white/30 ${numberSide === "right" ? "text-left pl-1.5" : "text-right pr-1.5"}`}
    >
      {number}
    </span>
  )

  return (
    <div
      className="flex items-center relative"
      onMouseEnter={() => unit?.clientName && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {numberSide === "left" && numberLabel}
      <button
        data-deeplink-id={unit?.dbId}
        onClick={() => onClick(unit)}
        className={`w-6 h-4.5 md:w-7 md:h-5 text-[9px] font-bold flex flex-col items-center justify-center border rounded-sm cursor-pointer transition-colors relative ${styles} ${opacityClass} ${highlightClass} ${unit?.esPreconfirmadaWeb ? "border-dashed" : ""}`}
      >
        <span className="leading-none">
          {isPendienteConfirmacion && <Hourglass size={9} />}
          {isTemporada && "T"}
          {isPeriodo && "P"}
          {isDia && "D"}
        </span>
        {unit?.isPaid && isOcupada && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
        )}
        {/* D5 (Fase 3 Recepción): reserva web preconfirmada vigente — mismo
            borde punteado de arriba + reloj, nunca color nuevo. */}
        {unit?.esPreconfirmadaWeb && (
          <Clock size={7} className="absolute -bottom-0.5 -right-0.5 text-current opacity-80" />
        )}
      </button>
      {numberSide === "right" && numberLabel}

      {/* Tooltip */}
      {showTooltip && unit?.clientName && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 glass-tooltip text-white text-[11px] p-4 rounded-xl shadow-2xl z-50 pointer-events-none border border-white/20">
          <p className="font-bold uppercase tracking-wider text-[#FDE047] mb-2">{unit.clientName}</p>
          <div className="space-y-1 opacity-80 font-medium">
            {isPendienteConfirmacion ? (
              <>
                <p className="text-white/90">Cliente de la temporada pasada</p>
                <p className="font-bold mt-2 text-gray-300 normal-case tracking-normal">
                  Todavía no confirmó ni pagó nada para esta temporada
                </p>
              </>
            ) : (
              <>
                {isTemporada ? (
                  <p>Temporada Completa</p>
                ) : isDia ? (
                  <p>Día {unit.startDate}</p>
                ) : (
                  <p>{unit.startDate} al {unit.endDate}</p>
                )}
                <p className={`font-bold mt-2 ${unit.isPaid ? 'text-green-400' : 'text-red-400'}`}>
                  {unit.isPaid ? "PAGADO" : "PAGO PENDIENTE"}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(Cell)

import { memo, useRef, useState } from "react"
import { Hourglass, Clock } from "lucide-react"
import { STATUS } from "./constants"
import { COLOR_TIPO_ALQUILER, COLOR_ESTADO } from "../../lib/colors"
import CellTooltip from "./CellTooltip"

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
//
// `modoCliente` (pantalla completa, para mostrarle el plano al cliente): toda unidad ocupada
// (incluida la pendiente de confirmación) se ve del MISMO color de "ocupada", sin letra T/P/D,
// sin punto de pagada, sin reloj ni borde punteado y sin tooltip con el titular: nada que
// distinga saldo, tipo de alquiler ni persona.
function Cell({ number, unit, onClick, isHighlighted, isDimmed, numberSide = "left", modoCliente = false }) {
  const status = unit?.status || STATUS.LIBRE
  const isPendienteConfirmacion = status === STATUS.PENDIENTE_CONFIRMACION
  const isTemporada = status === STATUS.TEMPORADA
  const isPeriodo = status === STATUS.PERIODO
  const isDia = status === STATUS.DIA
  const isOcupada = isTemporada || isPeriodo || isDia || isPendienteConfirmacion
  const [showTooltip, setShowTooltip] = useState(false)
  // Ancla del tooltip: el cartel vive en un portal fuera del plano (ver
  // CellTooltip.jsx) y se posiciona midiendo esta celda.
  const anclaRef = useRef(null)

  const styles = modoCliente && isOcupada
    ? `${COLOR_ESTADO.ocupada.bg} ${COLOR_ESTADO.ocupada.text} ${COLOR_ESTADO.ocupada.border}`
    : isPendienteConfirmacion
    ? "bg-white text-black border-[#E5E5E5] dark:bg-surface dark:text-ink dark:border-line"
    : isTemporada
      ? `${COLOR_TIPO_ALQUILER.temporada.bg} ${COLOR_TIPO_ALQUILER.temporada.text} ${COLOR_TIPO_ALQUILER.temporada.border}`
      : isPeriodo
        ? `${COLOR_TIPO_ALQUILER.periodo.bg} ${COLOR_TIPO_ALQUILER.periodo.text} ${COLOR_TIPO_ALQUILER.periodo.border}`
        : isDia
          ? `${COLOR_TIPO_ALQUILER.dia.bg} ${COLOR_TIPO_ALQUILER.dia.text} ${COLOR_TIPO_ALQUILER.dia.border}`
          // Libre (bug real, oct 2026 testing): antes "white/5 border-white/10"
          // — pensado para el fondo dark glass viejo, invisible sobre el
          // card-light blanco real de hoy. Borde sutil #E5E5E5 (Quiet Luxury).
          // Modo oscuro (nov 2026): la casilla libre pasa a la superficie
          // oscura de la app con borde gris oscuro sutil — 184 casillas
          // blancas sobre el lienzo oscuro encandilaban. Solo color.
          : "bg-white text-plano-muted border-[#E5E5E5] hover:border-black/30 dark:bg-surface dark:text-ink-2 dark:border-line dark:hover:border-white/30"

  const opacityClass = isDimmed ? "opacity-20" : "opacity-100"
  const highlightClass = isHighlighted
    ? "ring-2 ring-[#FDE047] scale-105 z-10 shadow-[0_0_15px_rgba(253,224,71,0.3)]"
    : ""

  const numberLabel = (
    <span
      className={`plano-contra w-7 md:w-8 text-xs md:text-sm font-bold tabular-nums text-black dark:text-ink ${numberSide === "right" ? "text-left pl-1" : "text-right pr-1"}`}
    >
      {number}
    </span>
  )

  return (
    <div
      ref={anclaRef}
      className="flex items-center relative cursor-pointer select-none"
      onClick={() => onClick(unit)}
      onMouseEnter={() => !modoCliente && unit?.clientName && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {numberSide === "left" && numberLabel}
      <button
        data-deeplink-id={unit?.dbId}
        tabIndex={-1}
        className={`w-6 h-[18px] md:w-7 md:h-5 text-[10px] md:text-[11px] font-bold flex flex-col items-center justify-center border rounded-sm cursor-pointer transition-colors relative pointer-events-none ${styles} ${opacityClass} ${highlightClass} ${!modoCliente && unit?.esPreconfirmadaWeb ? "border-dashed" : ""}`}
      >
        <span className="plano-contra leading-none">
          {!modoCliente && isPendienteConfirmacion && <Hourglass size={11} />}
          {!modoCliente && isTemporada && "T"}
          {!modoCliente && isPeriodo && "P"}
          {!modoCliente && isDia && "D"}
        </span>
        {!modoCliente && unit?.isPaid && isOcupada && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
        )}
        {/* D5 (Fase 3 Recepción): reserva web preconfirmada vigente — mismo
            borde punteado de arriba + reloj, nunca color nuevo. */}
        {!modoCliente && unit?.esPreconfirmadaWeb && (
          <Clock size={7} className="absolute -bottom-0.5 -right-0.5 text-current opacity-80" />
        )}
      </button>
      {numberSide === "right" && numberLabel}

      {/* Tooltip — en un portal a document.body: con zoom, dentro del
          contenedor del plano quedaba cortado (overflow + transform). */}
      {!modoCliente && showTooltip && unit?.clientName && (
        <CellTooltip anchorRef={anclaRef}>
        <div className="w-52 glass-tooltip text-white text-[11px] p-4 rounded-xl shadow-2xl pointer-events-none border border-white/20">
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
        </CellTooltip>
      )}
    </div>
  )
}

export default memo(Cell)

import { Hourglass, Clock } from "lucide-react"

// Leyenda real del Plano — ÚNICA fuente compartida entre desktop/tablet
// (Dashboard.jsx) y mobile (PlanoMobile.jsx), oct 2026. Explica los 6
// indicadores reales de Cell.jsx/CellMobile.jsx (colores + T/P/D + reloj de
// arena + punto verde + reloj chico), no una versión simplificada — ver
// comentario de "6 variantes visuales" en Cell.jsx.
const ITEMS = [
  { swatch: <span className="w-3.5 h-3.5 rounded bg-white border border-hairline shrink-0" />, label: "Libre", hint: "sin reserva vigente" },
  { swatch: <span className="w-3.5 h-3.5 rounded bg-black shrink-0" />, label: "Ocupada", hint: "pagada al 100%" },
  { swatch: <span className="w-3.5 h-3.5 rounded bg-[#F2CA50] shrink-0" />, label: "Ocupada", hint: "con saldo pendiente" },
  { swatch: <span className="w-3.5 h-3.5 rounded-full bg-prius-subtle border border-hairline flex items-center justify-center text-[9px] font-bold text-prius-slate shrink-0">T</span>, label: "T / P / D", hint: "temporada / período / día" },
  { swatch: <Hourglass size={14} className="text-prius-slate shrink-0" />, label: "Sin confirmar", hint: "cliente de temporada pasada" },
  { swatch: <Clock size={13} className="text-prius-slate shrink-0" />, label: "Reserva web", hint: "preconfirmada, sin check-in" },
]

export default function PlanoLeyenda({ compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none shrink-0">
        {ITEMS.map((it, i) => (
          <span key={i} className="flex items-center gap-1.5 shrink-0 text-body-sm text-prius-slate whitespace-nowrap">
            {it.swatch}
            {it.label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 bg-prius-subtle px-3 py-1.5 rounded-xl flex-wrap">
      {ITEMS.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 text-body-sm text-prius-slate whitespace-nowrap">
          {it.swatch}
          <span>{it.label} <span className="text-prius-muted">· {it.hint}</span></span>
        </span>
      ))}
    </div>
  )
}

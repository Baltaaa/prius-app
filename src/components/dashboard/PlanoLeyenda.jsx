import { Hourglass, Clock } from "lucide-react"
import { COLOR_ESTADO } from "../../lib/colors"

// Leyenda real del Plano — ÚNICA fuente compartida entre desktop/tablet
// (Dashboard.jsx) y mobile (PlanoMobile.jsx), oct 2026. Explica los 6
// indicadores reales de Cell.jsx/CellMobile.jsx (colores + T/P/D + reloj de
// arena + punto verde + reloj chico), no una versión simplificada — ver
// comentario de "6 variantes visuales" en Cell.jsx.
const ITEMS = [
  { swatch: <span className={`w-3.5 h-3.5 rounded-swatch border shrink-0 ${COLOR_ESTADO.sinConfirmar.bg} ${COLOR_ESTADO.sinConfirmar.border}`} />, label: "Libre", hint: "sin reserva vigente" },
  { swatch: <span className={`w-3.5 h-3.5 rounded-swatch shrink-0 ${COLOR_ESTADO.pagado.bg}`} />, label: "Ocupada", hint: "pagada al 100%" },
  { swatch: <span className={`w-3.5 h-3.5 rounded-swatch shrink-0 ${COLOR_ESTADO.conSaldo.bg}`} />, label: "Ocupada", hint: "con saldo pendiente" },
  { swatch: <span className="w-3.5 h-3.5 rounded-full bg-surface border border-line flex items-center justify-center text-label font-semibold text-ink-2 shrink-0">T</span>, label: "T / P / D", hint: "temporada / período / día" },
  { swatch: <Hourglass size={14} className="text-ink-2 shrink-0" />, label: "Sin confirmar", hint: "cliente de temporada pasada" },
  { swatch: <Clock size={13} className="text-ink-2 shrink-0" />, label: "Reserva web", hint: "preconfirmada, sin check-in" },
]

export default function PlanoLeyenda({ compact = false }) {
  if (compact) {
    // Pulido UX (oct 2026, item 6): antes era una sola fila con scroll
    // horizontal — el último ítem ("Reserva web") quedaba fuera de vista
    // sin que se notara que había que scrollear, y a mitad de scroll
    // "Sin confirmar" se veía cortado ("Sin c…"). flex-wrap en dos
    // renglones prolijos, todo siempre visible, sin scroll.
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0">
        {ITEMS.map((it, i) => (
          <span key={i} className="flex items-center gap-1.5 shrink-0 text-label text-ink-2 whitespace-nowrap">
            {it.swatch}
            {it.label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 bg-surface px-3 py-1.5 rounded-inner flex-wrap">
      {ITEMS.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 text-label text-ink-2 whitespace-nowrap">
          {it.swatch}
          <span>{it.label} <span className="text-ink-2">· {it.hint}</span></span>
        </span>
      ))}
    </div>
  )
}

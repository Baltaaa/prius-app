import { Hourglass, Clock } from "lucide-react"
import { COLOR_ESTADO } from "../../lib/colors"

// Leyenda real del Plano — ÚNICA fuente compartida entre desktop/tablet
// (Dashboard.jsx) y mobile (PlanoMobile.jsx), oct 2026. Los nombres salen de
// lib/colors.ts (COLOR_ESTADO): el negro es "Pagada" y el dorado "Con saldo". Explica los 6
// indicadores reales de Cell.jsx/CellMobile.jsx (colores + T/P/D + reloj de
// arena + punto verde + reloj chico), no una versión simplificada — ver
// comentario de "6 variantes visuales" en Cell.jsx.
const ITEMS = [
  { swatch: <span className={`w-3.5 h-3.5 rounded-swatch border shrink-0 ${COLOR_ESTADO.sinConfirmar.bg} ${COLOR_ESTADO.sinConfirmar.border}`} />, label: "Libre", hint: "sin reserva vigente" },
  { swatch: <span className={`w-3.5 h-3.5 rounded-swatch shrink-0 ${COLOR_ESTADO.pagado.bg}`} />, label: "Pagada", hint: "ocupada, pagada al 100%" },
  { swatch: <span className={`w-3.5 h-3.5 rounded-swatch shrink-0 ${COLOR_ESTADO.conSaldo.bg}`} />, label: "Con saldo", hint: "ocupada, saldo pendiente" },
  { swatch: <span className="w-3.5 h-3.5 rounded-full bg-surface border border-line flex items-center justify-center text-label font-semibold text-ink-2 shrink-0">T</span>, label: "T / P / D", hint: "temporada / período / día" },
  { swatch: <Hourglass size={14} className="text-ink-2 shrink-0" />, label: "Sin confirmar", hint: "cliente de temporada pasada" },
  { swatch: <Clock size={13} className="text-ink-2 shrink-0" />, label: "Reserva web", hint: "preconfirmada, sin check-in" },
]

// Vive dentro del popover "Referencias" (PlanoFiltros.jsx), una fila por
// indicador: nombre y significado, sin ambigüedad entre estados.
export default function PlanoLeyenda() {
  return (
    <ul className="flex flex-col gap-3">
      {ITEMS.map((it, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="w-5 h-5 flex items-center justify-center shrink-0">{it.swatch}</span>
          <span className="min-w-0 text-label text-ink">
            {it.label}
            <span className="block text-ink-2">{it.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

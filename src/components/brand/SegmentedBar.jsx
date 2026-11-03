import GrowBar from './motion/GrowBar'
import { formatPorcentaje } from '../../lib/format'

// Barra segmentada con leyenda: swatch + nombre + valor + porcentaje. El
// porcentaje siempre está escrito, la identidad nunca depende solo del color.
// `items`: [{ key, label, value, detail, swatch }], `swatch` es una clase bg-*.
export default function SegmentedBar({ items, label }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <div>
      <div role="img" aria-label={label} className="flex gap-1 h-9">
        {items.filter((i) => i.value > 0).map((i, idx) => (
          <div key={i.key} className="min-w-[8px] rounded-bar overflow-hidden" style={{ flexGrow: i.value, flexBasis: 0 }}>
            <GrowBar index={idx} className={`h-full rounded-bar ${i.swatch}`} />
          </div>
        ))}
      </div>
      <ul className="mt-4 md:mt-5 space-y-3">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 min-w-0">
            <span className={`w-5 h-5 rounded-swatch shrink-0 ${i.swatch}`} />
            <span className="text-body text-ink min-w-0">{i.label}</span>
            <span className="ml-auto text-label text-ink-2 tabular-nums whitespace-nowrap">{i.detail ?? i.value}</span>
            <span className="w-14 text-right text-card-title text-ink tabular-nums">
              {formatPorcentaje(total ? (i.value / total) * 100 : 0, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

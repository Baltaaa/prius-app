import { ArrowDown, ArrowUp } from 'lucide-react'

// Variación: pill negra con flecha y valor.
export function DeltaBadge({ value, down = false, className = '' }) {
  const Flecha = down ? ArrowDown : ArrowUp
  return (
    <span className={`inline-flex items-center gap-1 h-7 px-3 rounded-full bg-ink text-on-ink text-label tabular-nums whitespace-nowrap ${className}`}>
      <Flecha size={14} strokeWidth={1.5} /> {value}
    </span>
  )
}

// Contador: círculo negro de 22px (Leads, por ejemplo).
export function CountBadge({ value, className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-ink text-on-ink text-[12px] font-semibold tabular-nums ${className}`}>
      {value}
    </span>
  )
}

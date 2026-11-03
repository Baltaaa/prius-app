// Opciones en texto, la activa en pill negra.
export default function SegmentedControl({ options, value, onChange, label, className = '' }) {
  return (
    <div role="group" aria-label={label} className={`inline-flex items-center gap-1 p-1 rounded-full bg-surface ${className}`}>
      {options.map((o) => {
        const activa = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activa}
            onClick={() => onChange(o.value)}
            className={`h-11 md:h-8 min-h-0 px-4 rounded-full text-label transition-colors ${activa ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

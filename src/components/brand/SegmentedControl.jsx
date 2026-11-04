// Opciones en texto, la activa en pill negra.
export default function SegmentedControl({ options, value, onChange, label, className = '', fullWidth = false, compact = false }) {
  // fullWidth: a ancho completo siempre; 'hasta-lg' / 'hasta-md': a ancho
  // completo por debajo de 1024px / 768px y a su ancho natural desde ahí.
  const hastaLg = fullWidth === 'hasta-lg'
  const hastaMd = fullWidth === 'hasta-md'
  return (
    <div role="group" aria-label={label} className={`${fullWidth ? `flex w-full ${hastaLg ? 'lg:inline-flex lg:w-auto' : ''} ${hastaMd ? 'md:inline-flex md:w-auto' : ''}` : 'inline-flex'} items-center gap-1 p-1 rounded-full bg-surface ${className}`}>
      {options.map((o) => {
        const activa = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activa}
            onClick={() => onChange(o.value)}
            className={`h-11 md:h-8 min-h-0 ${compact ? 'min-w-11 px-2' : 'px-4'} rounded-full text-label transition-colors ${fullWidth ? `flex-1 min-w-0 px-2 ${hastaLg ? 'lg:flex-none lg:px-4' : ''} ${hastaMd ? `md:flex-none ${compact ? 'md:px-3' : 'md:px-4'}` : ''}` : ''} ${activa ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

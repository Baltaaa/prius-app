import { useCallback, useEffect, useRef, useState } from 'react'

// Segmented de UNA sola línea para listas largas de opciones (tabs de tipo del
// Historial). Si no entran, scrollea en horizontal con snap y se desvanece en
// los bordes que tienen contenido oculto; nunca baja a una segunda línea.
export default function SegmentedScroll({ options, value, onChange, label, className = '' }) {
  const ref = useRef(null)
  const [bordes, setBordes] = useState({ izq: false, der: false })

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    const izq = el.scrollLeft > 1
    const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setBordes((p) => (p.izq === izq && p.der === der ? p : { izq, der }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', medir)
      ro.disconnect()
    }
  }, [medir])

  // La opción activa siempre a la vista.
  useEffect(() => {
    const cont = ref.current
    const activa = cont?.querySelector('[aria-pressed="true"]')
    if (!cont || !activa) return
    // Solo se mueve si la opción activa queda fuera de la vista (nunca en el arranque).
    if (activa.offsetLeft < cont.scrollLeft) cont.scrollLeft = Math.max(0, activa.offsetLeft - 8)
    else if (activa.offsetLeft + activa.offsetWidth > cont.scrollLeft + cont.clientWidth) cont.scrollLeft = activa.offsetLeft + activa.offsetWidth - cont.clientWidth + 8
  }, [value])

  const mask = bordes.izq || bordes.der
    ? `linear-gradient(to right, ${bordes.izq ? 'transparent 0, black 28px' : 'black 0'}, ${bordes.der ? 'black calc(100% - 28px), transparent 100%' : 'black 100%'})`
    : undefined

  return (
    <div className={`rounded-full bg-surface max-w-full ${className}`}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className="scroll-x-snap flex items-center gap-1 p-1 rounded-full"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {options.map((o) => {
          const activa = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={activa}
              onClick={() => onChange(o.value)}
              className={`shrink-0 h-11 md:h-8 min-h-0 px-4 rounded-full text-label transition-colors ${activa ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink'}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

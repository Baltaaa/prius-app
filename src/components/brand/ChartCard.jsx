import { useId, useMemo, useState } from 'react'

const ALTO = 100

// Curva suave entre puntos: bezier con los controles a mitad de camino, sin
// sobrepasar los extremos reales del dato.
function trazar(puntos) {
  return puntos.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x} ${y}`
    const [px, py] = puntos[i - 1]
    const medio = (px + x) / 2
    return `${d} C${medio} ${py} ${medio} ${y} ${x} ${y}`
  }, '')
}

// Línea de una sola serie: el título de la card la nombra, no lleva leyenda.
// `data`: [{ x, y }]. `formatY` es el formateador de la app. `activoInicial`
// marca el índice que queda seleccionado sin hover (la hora actual).
// La guía, el punto y el tooltip son HTML: el SVG se estira al ancho real y
// deformaría cualquier forma que no sea la línea.
export default function ChartCard({ data, formatY, activoInicial = 0, etiquetaX = 3, descripcion, className = '' }) {
  const id = useId()
  const [hover, setHover] = useState(null)
  const validos = useMemo(() => data.filter((d) => d.y != null), [data])

  const { puntos, posiciones } = useMemo(() => {
    const ys = validos.map((d) => Number(d.y))
    const min = Math.min(...ys)
    const max = Math.max(...ys)
    const margen = (max - min || 1) * 0.25
    const escalaY = (v) => ALTO - ((v - (min - margen)) / (max - min + margen * 2)) * ALTO
    const ultimo = Math.max(validos.length - 1, 1)
    const pos = validos.map((d, i) => ({ x: (i / ultimo) * 100, y: escalaY(Number(d.y)) }))
    return { puntos: pos.map((p) => [p.x, p.y]), posiciones: pos }
  }, [validos])

  if (validos.length < 2) return null

  const activo = Math.min(hover ?? activoInicial, validos.length - 1)
  const punto = posiciones[activo]
  const linea = trazar(puntos)
  const area = `${linea} L100 ${ALTO} L0 ${ALTO} Z`

  const seleccionar = (e) => {
    const caja = e.currentTarget.getBoundingClientRect()
    const relativo = (e.clientX - caja.left) / caja.width
    setHover(Math.max(0, Math.min(validos.length - 1, Math.round(relativo * (validos.length - 1)))))
  }

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={descripcion}
        onPointerMove={seleccionar}
        onPointerDown={seleccionar}
        onPointerLeave={() => setHover(null)}
        className="relative h-44 md:h-52 touch-pan-y select-none"
      >
        <svg viewBox={`0 0 100 ${ALTO}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" className="text-gold-300" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-gold-300" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id})`} />
          <path d={linea} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" className="text-ink" />
        </svg>
        {/* El trazo "se dibuja" con un telón que se corre: solo transform, y
            sin los problemas de dasharray con non-scaling-stroke. */}
        <div aria-hidden="true" className="absolute -inset-x-1 inset-y-0 bg-card pointer-events-none anim-curtain" />
        <div className="absolute inset-y-0 border-l border-dashed border-ink/40 pointer-events-none" style={{ left: `${punto.x}%` }} />
        <div
          className="absolute w-3 h-3 -ml-2 -mt-2 rounded-full bg-ink ring-2 ring-card pointer-events-none"
          style={{ left: `${punto.x}%`, top: `${punto.y}%` }}
        />
        <div
          className="absolute -translate-x-1/2 -translate-y-full -mt-3 h-8 px-3 flex items-center rounded-full bg-ink text-on-ink text-label tabular-nums whitespace-nowrap pointer-events-none"
          style={{ left: `${Math.min(86, Math.max(14, punto.x))}%`, top: `${Math.max(16, punto.y)}%` }}
        >
          {validos[activo].x} · {formatY(validos[activo].y)}
        </div>
      </div>
      <div className="relative h-5 mt-2 text-label text-ink-2 tabular-nums" aria-hidden="true">
        {validos.map((d, i) => (i % etiquetaX === 0 ? (
          <span
            key={d.x}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${posiciones[i].x}%` }}
          >
            {d.x}
          </span>
        ) : null))}
      </div>
      <table className="sr-only">
        <tbody>
          {validos.map((d) => <tr key={d.x}><th scope="row">{d.x}</th><td>{formatY(d.y)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

// Identidad Prius: patrones SVG de líneas finas, siempre decorativos
// (aria-hidden, sin eventos). La opacidad va de 3 a 8% según DESIGN.md.
function Patron({ children, viewBox, opacity, className }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      preserveAspectRatio="xMaxYMax slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      style={{ opacity }}
      className={`pointer-events-none absolute ${className}`}
    >
      {children}
    </svg>
  )
}

const OLAS = Array.from({ length: 9 }, (_, i) => {
  const y = 20 + i * 20
  return `M0 ${y} C 60 ${y - 18}, 90 ${y + 18}, 150 ${y} S 240 ${y - 18}, 300 ${y} S 390 ${y + 18}, 450 ${y}`
})

export function Olas({ opacity = 0.05, className = 'right-0 bottom-0 h-full w-2/3' }) {
  return (
    <Patron viewBox="0 0 450 200" opacity={opacity} className={className}>
      {OLAS.map((d) => <path key={d} d={d} />)}
    </Patron>
  )
}

export function Rayas({ opacity = 0.04, className = 'right-0 top-0 h-full w-1/2' }) {
  return (
    <Patron viewBox="0 0 300 200" opacity={opacity} className={className}>
      {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${i * 24 - 60} 200 L${i * 24 + 60} 0`} strokeWidth="2.5" />)}
    </Patron>
  )
}

export function Topografia({ opacity = 0.05, className = 'right-0 top-0 h-full w-1/2' }) {
  return (
    <Patron viewBox="0 0 300 200" opacity={opacity} className={className}>
      {[30, 55, 80, 105, 130, 155, 180].map((r) => (
        <ellipse key={r} cx="260" cy="30" rx={r * 1.25} ry={r * 0.8} transform={`rotate(${r / 6} 260 30)`} />
      ))}
    </Patron>
  )
}

// Barra o segmento que crece desde 0. Solo scaleX: el ancho real lo da el
// layout, así no hay reflow mientras anima.
export default function GrowBar({ index = 0, className = '' }) {
  return <div className={`anim-grow ${className}`} style={{ animationDelay: `${index * 80}ms` }} />
}

// Card base: blanca, sin borde, separada del fondo por contraste. `onClick`
// la vuelve botón y le suma el hover de elevación; los paneles con scroll
// interno no lo llevan.
export default function Card({ title, action, className = '', padded = true, onClick, children }) {
  const Tag = onClick ? 'button' : 'section'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card-surface ${padded ? 'card-pad' : ''} ${onClick ? 'card-hover text-left w-full whitespace-normal' : ''} ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 mb-4 md:mb-5">
          {title && <h2 className="text-card-title text-ink min-w-0">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </Tag>
  )
}

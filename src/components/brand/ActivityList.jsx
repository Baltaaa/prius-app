// Filas de actividad: ícono en cuadrado de 12px, título y subtítulo a la
// izquierda, dato a la derecha. `items`: [{ id, icon, title, subtitle, meta, onClick }].
export default function ActivityList({ items, empty }) {
  if (!items.length) return <p className="text-label text-ink-2 py-6 text-center">{empty}</p>
  return (
    <ul className="divide-y divide-divider">
      {items.map(({ id, icon: Icon, title, subtitle, meta, onClick }) => (
        <li key={id}>
          <button
            type="button"
            onClick={onClick}
            className="w-full min-h-[56px] py-3 flex items-center gap-3 text-left whitespace-normal hover-row rounded-icon"
          >
            <span className="w-10 h-10 rounded-icon bg-surface text-ink flex items-center justify-center shrink-0">
              <Icon size={20} strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body text-ink truncate" title={title}>{title}</span>
              <span className="block text-label text-ink-2 truncate" title={subtitle}>{subtitle}</span>
            </span>
            <span className="text-label text-ink-2 tabular-nums shrink-0">{meta}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

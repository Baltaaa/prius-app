// Accesos rápidos 3x2: ícono en círculo de 44px con label debajo.
export default function QuickActions({ items }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 h-full content-around">
      {items.map(({ key, label, icon: Icon, onClick }) => (
        <button key={key} type="button" onClick={onClick} className="group flex flex-col items-center gap-2 min-w-0 whitespace-normal anim-press">
          <span className="w-11 h-11 rounded-full bg-surface text-ink flex items-center justify-center group-hover:bg-gold-100 anim-colors">
            <Icon size={20} strokeWidth={1.5} />
          </span>
          <span className="text-label text-ink text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  )
}

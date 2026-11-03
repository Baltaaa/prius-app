import Card from './Card'
import CountUp from './motion/CountUp'

// KPI secundario: label + valor animado + bajada opcional.
export default function StatCard({ label, value, format, sub, icon: Icon, onClick, className = '' }) {
  return (
    <Card onClick={onClick} className={className}>
      <div className="flex items-center gap-2 text-label text-ink-2">
        {Icon && <Icon size={16} strokeWidth={1.5} />}
        {label}
      </div>
      <p className="text-stat text-ink mt-2"><CountUp value={value} format={format} /></p>
      {sub && <p className="text-label text-ink-2 mt-1">{sub}</p>}
    </Card>
  )
}

import { Olas } from './patterns'

// Card protagonista del Dashboard. Sobre el degradé dorado el texto va siempre
// en ink: el gris secundario no llega a 4.5:1 ahí.
export default function HeroCard({ title, action, children, className = '' }) {
  return (
    <section className={`relative overflow-hidden rounded-card bg-hero card-pad-hero text-ink ${className}`}>
      <Olas opacity={0.05} />
      <div className="relative h-full flex flex-col">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-card-title">{title}</h2>
          {action}
        </header>
        {children}
      </div>
    </section>
  )
}

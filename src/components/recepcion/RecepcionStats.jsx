import GrowBar from '../brand/motion/GrowBar'
import CountUp from '../brand/motion/CountUp'
import { formatCantidad } from '../../lib/format'

// Llegan hoy / Ingresados / Pendientes, todo con datos reales (lib/recepcion.js),
// y una barra segmentada: lo que ya ingresó y lo que falta.
function Dato({ label, valor }) {
  return (
    <div className="min-w-0">
      <p className="text-label text-ink-2 truncate">{label}</p>
      <p className="text-stat tabular-nums"><CountUp value={valor} format={formatCantidad} /></p>
    </div>
  )
}

export default function RecepcionStats({ stats }) {
  const { total, ingresados, pendientes } = stats
  return (
    <section className="card-surface card-pad">
      <div className="grid grid-cols-3 gap-3">
        <Dato label="Llegan hoy" valor={total} />
        <Dato label="Ingresados" valor={ingresados} />
        <Dato label="Pendientes" valor={pendientes} />
      </div>
      <div
        role="img"
        aria-label={total ? `${ingresados} de ${total} ingresaron` : 'Nadie con reserva web hoy'}
        className="mt-4 flex gap-1 h-2"
      >
        {total === 0 ? (
          <div className="flex-1 rounded-bar bg-surface" />
        ) : (
          <>
            {ingresados > 0 && <div className="rounded-bar overflow-hidden min-w-[8px]" style={{ flexGrow: ingresados, flexBasis: 0 }}><GrowBar index={0} className="h-full rounded-bar bg-ink" /></div>}
            {pendientes > 0 && <div className="rounded-bar overflow-hidden min-w-[8px]" style={{ flexGrow: pendientes, flexBasis: 0 }}><GrowBar index={1} className="h-full rounded-bar bg-gold" /></div>}
          </>
        )}
      </div>
      <ul className="mt-3 flex items-center gap-4 text-label text-ink-2">
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch bg-ink" /> Ingresados</li>
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch bg-gold" /> Pendientes</li>
      </ul>
    </section>
  )
}

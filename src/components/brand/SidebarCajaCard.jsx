import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useCaja } from '../../hooks/useCaja'
import { formatPesos } from '../../lib/format'
import { Olas } from './patterns'

// Estado real de la Caja diaria. En desktop vive al pie del sidebar; en mobile
// y tablet, donde no hay sidebar, el Dashboard la muestra como card. El total
// es la misma columna que lee "ingresos del día" en lib/planoStats.js.
export default function SidebarCajaCard({ subtitulo, className = '' }) {
  const navigate = useNavigate()
  const { cajaHoy } = useCaja()
  const cerrada = cajaHoy?.estado === 'cerrada'

  return (
    <section className={`relative overflow-hidden rounded-card bg-ink text-on-ink p-4 ${className}`}>
      <span className="text-gold"><Olas opacity={0.08} className="right-0 bottom-0 h-full w-full" /></span>
      <div className="relative">
        <div className="flex items-center gap-2 text-label text-on-ink/70">
          <Wallet size={16} strokeWidth={1.5} />
          Caja diaria
        </div>
        {cajaHoy ? (
          <button type="button" onClick={() => navigate('/app/caja')} className="block w-full text-left mt-1">
            <span className="block text-stat tabular-nums whitespace-nowrap">{formatPesos(Number(cajaHoy.total_cobros || 0))}</span>
            <span className="block text-label text-on-ink/70 truncate">{subtitulo || (cerrada ? 'Cerrada · total del día' : 'Abierta · total del día')}</span>
          </button>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-body">Sin iniciar</span>
            <button type="button" onClick={() => navigate('/app/caja')} className="btn btn-gold h-11 md:h-9 min-h-0 px-4">Abrir</button>
          </div>
        )}
      </div>
    </section>
  )
}

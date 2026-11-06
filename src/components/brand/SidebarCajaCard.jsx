import { AvisoArqueoPendiente } from '../crm/AvisosCaja'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Wallet } from 'lucide-react'
import { useCaja } from '../../hooks/useCaja'
import { useOcultarMonto } from '../../hooks/useOcultarMonto'
import { formatPesos } from '../../lib/format'
import { Olas } from './patterns'

// Estado real de la Caja diaria. En desktop vive al pie del sidebar; en mobile
// y tablet, donde no hay sidebar, el Dashboard la muestra como card. El total
// es la misma columna que lee "ingresos del día" en lib/planoStats.js.
// Ojito: oculta el monto como en las billeteras virtuales ("$ ••••••"); la
// preferencia se recuerda por usuario. Sin caja iniciada no hay monto, ni ojito.
const MONTO_OCULTO = '$ ••••••'

export default function SidebarCajaCard({ subtitulo, className = '' }) {
  const navigate = useNavigate()
  const { cajaHoy } = useCaja()
  const [oculto, alternarOculto] = useOcultarMonto('caja')
  const cerrada = cajaHoy?.estado === 'cerrada'
  const monto = formatPesos(Number(cajaHoy?.total_cobros || 0)).replace(/ /g, ' ')

  return (
    <section className={`relative overflow-hidden rounded-card bg-ink text-on-ink p-4 ${className}`}>
      <span className="text-gold"><Olas opacity={0.08} className="right-0 bottom-0 h-full w-full" /></span>
      <div className="relative">
        <div className="flex items-center gap-2 text-label text-on-ink/70">
          <Wallet size={16} strokeWidth={1.5} />
          Caja diaria
        </div>
        {cajaHoy ? (
          <div className="mt-1 flex items-center justify-between gap-1">
            <button type="button" onClick={() => navigate('/app/caja')} className="min-w-0 flex-1 text-left">
              <span className="block text-amount tabular-nums whitespace-nowrap">{oculto ? MONTO_OCULTO : monto}</span>
              <span className="block text-label text-on-ink/70 truncate">{subtitulo || (cerrada ? 'Cerrada · total del día' : 'Abierta · total del día')}</span>
            </button>
            <button
              type="button"
              onClick={alternarOculto}
              aria-label={oculto ? 'Mostrar monto' : 'Ocultar monto'}
              aria-pressed={oculto}
              className="-mr-2 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-on-ink/70 hover:text-on-ink hover:bg-on-ink/10 transition-colors"
            >
              {oculto ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-body">Sin iniciar</span>
            <button type="button" onClick={() => navigate('/app/caja')} className="btn btn-gold h-11 md:h-9 min-h-0 px-4">Abrir</button>
          </div>
        )}
        <AvisoArqueoPendiente compacto />
      </div>
    </section>
  )
}

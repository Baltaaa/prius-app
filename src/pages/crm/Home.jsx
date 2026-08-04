import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { useCaja } from '../../hooks/useCaja'
import KpiCard from '../../components/crm/KpiCard'
import StatusBadge from '../../components/crm/StatusBadge'
import { Calendar, Wallet, Users, AlertCircle, ArrowRight } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const { reservas, unidades, loading: resLoading } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()
  const { cajaHoy, loading: cajaLoading } = useCaja()

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  const unidadesOcupadasCount = unidades.filter(u => u.estado === 'ocupada' || u.estado === 'reservada').length
  const totalCajaHoy = cajaHoy ? cajaHoy.total_cobros : 0
  const reservasConSaldoCount = reservas.filter(r => Number(r.saldo) > 0).length
  const clientesCount = clientes.length

  const recentReservas = reservas.slice(0, 5)

  if (resLoading || cliLoading || cajaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Sincronizando PriusAdmin...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Dashboard General</h1>
        <p className="text-gray-400 text-sm mt-2">Resumen de métricas y actividades principales en tiempo real.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Ocupación Total"
          value={`${unidadesOcupadasCount} / ${unidades.length}`}
          subtitle="Carpas y sombrillas alquiladas"
          icon={Calendar}
          highlight
        />
        <KpiCard
          title="Caja Diaria"
          value={formatCurrency(totalCajaHoy)}
          subtitle={cajaHoy ? 'Cobros registrados hoy' : 'Caja sin iniciar'}
          icon={Wallet}
        />
        <KpiCard
          title="Saldos Pendientes"
          value={reservasConSaldoCount}
          subtitle="Cuentas con saldo deudor"
          icon={AlertCircle}
        />
        <KpiCard
          title="Base de Clientes"
          value={clientesCount}
          subtitle="Clientes registrados"
          icon={Users}
        />
      </div>

      {/* Table Section */}
      <div className="glass-card p-8 rounded-2xl glass-card-inner">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-sm font-bold tracking-[0.2em] text-white uppercase">ÚLTIMAS RESERVAS REGISTRADAS</h2>
          <button
            onClick={() => navigate('/app/reservas')}
            className="bg-[#FDE047] hover:bg-yellow-300 text-black text-xs px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 font-bold uppercase tracking-wider"
          >
            Ver todas <ArrowRight size={16} />
          </button>
        </div>

        <div className="overflow-x-auto">
          {recentReservas.length === 0 ? (
            <p className="py-12 text-center text-gray-500 italic text-sm">No se han registrado reservas recientemente.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-gray-500 uppercase tracking-[0.15em] font-bold">
                  <th className="pb-4 px-6">FECHA</th>
                  <th className="pb-4 px-6">CLIENTE</th>
                  <th className="pb-4 px-6">SERVICIO</th>
                  <th className="pb-4 px-6">ESTADO</th>
                  <th className="pb-4 px-6 text-right">ACCIÓN</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-300 divide-y divide-white/5">
                {recentReservas.map((res) => (
                  <tr key={res.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-6 px-6 font-medium text-gray-400">
                      {res.created_at ? new Date(res.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-6 px-6 font-bold text-white uppercase tracking-tight">
                      {res.clientes?.nombre || 'CLIENTE S/N'}
                    </td>
                    <td className="py-6 px-6">
                      {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero || 'N/A'}
                    </td>
                    <td className="py-6 px-6">
                      <StatusBadge status={res.estado_pago} />
                    </td>
                    <td className="py-6 px-6 text-right">
                      <button 
                        onClick={() => navigate('/app/reservas')}
                        className="text-[#FDE047] hover:text-white font-bold text-xs uppercase underline-offset-4 hover:underline transition-all"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
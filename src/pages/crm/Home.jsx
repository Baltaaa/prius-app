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

  // Calculos KPI
  const unidadesOcupadasCount = unidades.filter(u => u.estado === 'ocupada' || u.estado === 'reservada').length
  const totalCajaHoy = cajaHoy ? cajaHoy.total_cobros : 0
  const reservasConSaldoCount = reservas.filter(r => Number(r.saldo) > 0).length
  const clientesCount = clientes.length

  const recentReservas = reservas.slice(0, 5)

  if (resLoading || cliLoading || cajaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-neutral-400">Cargando métricas de PriusAdmin...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex justify-between items-center pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">Dashboard General</h1>
          <p className="text-xs text-neutral-500 font-normal">Resumen de métricas y actividades principales en tiempo real.</p>
        </div>
      </div>

      {/* Metric Cards Row - PlainAdmin Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          subtitle={cajaHoy ? 'Cobros registrados hoy' : 'Caja de hoy sin iniciar'}
          icon={Wallet}
        />
        <KpiCard
          title="Saldos Pendientes"
          value={reservasConSaldoCount}
          subtitle="Clientes con cuentas corrientes"
          icon={AlertCircle}
        />
        <KpiCard
          title="Base de Clientes"
          value={clientesCount}
          subtitle="Clientes históricos registrados"
          icon={Users}
        />
      </div>

      {/* Recent Activity Table Container */}
      <div className="bg-white border border-[#E5E5E5] rounded p-5 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[#E5E5E5]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black">Últimas Reservas Registradas</h2>
          <button
            onClick={() => navigate('/app/reservas')}
            className="text-xs font-semibold text-black hover:text-[#F2CA50] flex items-center gap-1.5 transition-colors"
          >
            <span>Ver todas</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div>
          {recentReservas.length === 0 ? (
            <p className="py-8 text-xs text-center text-neutral-400">No hay reservas recientes registradas.</p>
          ) : (
            <div className="divide-y divide-[#E5E5E5] text-xs">
              {recentReservas.map((res) => (
                <div key={res.id} className="py-3 flex flex-col md:flex-row justify-between md:items-center gap-2 hover:bg-[#F9F9F9] px-2 rounded transition-colors">
                  <div>
                    <p className="font-bold text-black uppercase">
                      {res.clientes?.nombre || 'CLIENTE S/N'}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Unidad: {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero || 'N/A'} &bull; Temporada: {res.temporada}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <p className="font-semibold text-black">{formatCurrency(res.valor_total)}</p>
                      {Number(res.saldo) > 0 && (
                        <p className="text-[10px] text-red-600 font-semibold">Deuda: {formatCurrency(res.saldo)}</p>
                      )}
                    </div>
                    <StatusBadge status={res.estado_pago} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
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
      <div className="flex items-center justify-center h-full">
        <span className="text-xs uppercase tracking-widest font-bold text-neutral-400">Cargando métricas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      {/* Title */}
      <div className="pb-4 border-b border-[#E5E5E5]">
        <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-neutral-400 block mb-1">PANEL PRINCIPAL</span>
        <h1 className="text-xl uppercase tracking-wider font-extrabold font-display text-black">Inicio Prius App</h1>
        <p className="text-xs text-neutral-500 uppercase tracking-wide">Métricas operacionales de la temporada actual.</p>
      </div>

      {/* KPI Grid - Bento Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ocupación de Unidades"
          value={`${unidadesOcupadasCount} / ${unidades.length}`}
          subtitle="Carpas y sombrillas ocupadas"
          icon={Calendar}
          highlight
        />
        <KpiCard
          title="Caja Registrada Hoy"
          value={formatCurrency(totalCajaHoy)}
          subtitle={cajaHoy ? 'Arqueo de cobros registrados' : 'Caja diaria sin iniciar'}
          icon={Wallet}
        />
        <KpiCard
          title="Saldos por Cobrar"
          value={reservasConSaldoCount}
          subtitle="Clientes con saldo pendiente"
          icon={AlertCircle}
        />
        <KpiCard
          title="Clientes Históricos"
          value={clientesCount}
          subtitle="Registrados en la cartera"
          icon={Users}
        />
      </div>

      {/* Recent Reservations Bento Block */}
      <div className="p-6 border border-[#E5E5E5] bg-white rounded-sm space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E5]">
          <h2 className="text-xs uppercase tracking-widest font-bold text-neutral-400 font-display">Últimos Alquileres Registrados</h2>
          <button
            onClick={() => navigate('/app/reservas')}
            className="text-[10px] font-bold uppercase tracking-widest text-black hover:text-[#F2CA50] flex items-center gap-1 transition-colors"
          >
            <span>Ver Reservas</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="overflow-hidden">
          {recentReservas.length === 0 ? (
            <p className="py-6 text-xs text-center text-neutral-400 uppercase tracking-wider">Sin reservas recientes registradas.</p>
          ) : (
            <div className="divide-y divide-[#E5E5E5] text-xs">
              {recentReservas.map((res) => (
                <div key={res.id} className="py-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
                  <div>
                    <p className="font-bold uppercase text-black">
                      {res.clientes?.nombre || 'CLIENTE INNOMBRADO'}
                    </p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                      Unidad {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero || 'N/A'} — Temporada: {res.temporada}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <p className="font-bold text-black">{formatCurrency(res.valor_total)}</p>
                      {Number(res.saldo) > 0 && (
                        <p className="text-[9px] text-red-600 font-bold uppercase tracking-wider">Deuda: {formatCurrency(res.saldo)}</p>
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
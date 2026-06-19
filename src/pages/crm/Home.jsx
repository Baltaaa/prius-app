import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { useCaja } from '../../hooks/useCaja'
import KpiCard from '../../components/crm/KpiCard'
import StatusBadge from '../../components/crm/StatusBadge'
import { Calendar, Wallet, Users, AlertCircle } from 'lucide-react'

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
        <span className="text-xs uppercase tracking-widest font-semibold text-neutral-400">Cargando métricas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl uppercase tracking-wider font-extrabold font-display">Inicio Prius App</h1>
        <p className="text-xs text-neutral-500">Métricas operacionales del balneario al instante.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Ocupación Hoy"
          value={`${unidadesOcupadasCount} / ${unidades.length}`}
          subtitle="Unidades activas o reservadas"
          icon={Calendar}
          highlight
        />
        <KpiCard
          title="Caja del Día"
          value={formatCurrency(totalCajaHoy)}
          subtitle={cajaHoy ? 'Cobros registrados hoy' : 'Caja de hoy sin iniciar'}
          icon={Wallet}
        />
        <KpiCard
          title="Saldos Pendientes"
          value={reservasConSaldoCount}
          subtitle="Reservas con deuda activa"
          icon={AlertCircle}
        />
        <KpiCard
          title="Clientes Totales"
          value={clientesCount}
          subtitle="Clientes históricos registrados"
          icon={Users}
        />
      </div>

      {/* Recent Reservations list */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xs uppercase tracking-widest font-bold text-neutral-500 font-display">Últimas Reservas</h2>
          <button
            onClick={() => navigate('/app/reservas')}
            className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 hover:text-[#F2CA50]"
          >
            Ver Todas →
          </button>
        </div>

        <div className="bg-white border border-[#E5E5E5] overflow-hidden">
          {recentReservas.length === 0 ? (
            <p className="p-6 text-xs text-center text-neutral-400 uppercase">Sin reservas recientes registradas.</p>
          ) : (
            <div className="divide-y divide-[#E5E5E5] text-xs">
              {recentReservas.map((res) => (
                <div key={res.id} className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-2">
                  <div>
                    <p className="font-bold uppercase text-black">
                      {res.clientes?.nombre || 'CLIENTE ELIMINADO'}
                    </p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-tight">
                      Unidad {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero || 'N/A'} - Temporada: {res.temporada}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <p className="font-bold text-black">{formatCurrency(res.valor_total)}</p>
                      {Number(res.saldo) > 0 && (
                        <p className="text-[10px] text-red-600 font-semibold uppercase">Debes: {formatCurrency(res.saldo)}</p>
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
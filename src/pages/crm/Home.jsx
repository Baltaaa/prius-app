import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { useCaja } from '../../hooks/useCaja'
import KpiCard from '../../components/crm/KpiCard'
import StatusBadge from '../../components/crm/StatusBadge'
import ReservaDetalleModal from '../../components/crm/ReservaDetalleModal'
import { Calendar, Wallet, Users, AlertCircle, ArrowRight, Clock } from 'lucide-react'
import { formatPesos, formatFecha, unidadEmoji } from '../../lib/format'
import { estadoBadgeStatus } from '../../lib/reservas'
import { useRecientes } from '../../hooks/useRecientes'
import { linkToCliente, linkToReserva } from '../../lib/deepLinks'
import { isFeatureEnabled } from '../../lib/features'

export default function Home() {
  const navigate = useNavigate()
  const { reservas, unidades, loading: resLoading } = useReservas()
  const { clientes, loading: cliLoading } = useClientes()
  const { cajaHoy, historialCajas, loading: cajaLoading } = useCaja()
  const [detalleReserva, setDetalleReserva] = useState(null)
  const recientesFeatureOn = isFeatureEnabled('feat-4-recientes-home')
  const { items: recientes } = useRecientes(5)

  const unidadesOcupadasCount = unidades.filter(u => u.estado === 'ocupada' || u.estado === 'reservada').length
  const totalCajaHoy = cajaHoy ? cajaHoy.total_cobros : 0
  const reservasConSaldoCount = reservas.filter(r => Number(r.saldo) > 0).length
  const clientesCount = clientes.length

  // Caja Diaria: % contra el mejor día de cobros registrado en el historial
  // (nunca un techo inventado — si no hay historial más allá de hoy, no hay
  // referencia honesta y la barra queda oculta).
  const mejorDiaCaja = useMemo(
    () => Math.max(0, ...historialCajas.filter(c => c.fecha !== cajaHoy?.fecha).map(c => Number(c.total_cobros) || 0)),
    [historialCajas, cajaHoy],
  )

  // Saldos Pendientes: % del total facturado (valor_total de reservas activas)
  // que sigue sin cobrarse — nunca un número de reservas suelto sin contexto.
  const { totalFacturado, totalPendiente } = useMemo(() => {
    let facturado = 0, pendiente = 0
    for (const r of reservas) {
      if (r.estado === 'cancelada') continue
      facturado += Number(r.valor_total) || 0
      pendiente += Number(r.saldo) || 0
    }
    return { totalFacturado: facturado, totalPendiente: pendiente }
  }, [reservas])

  // Solo reservas reales de la cola operativa (mismo criterio que Reservas.jsx:
  // TIPOS_OPERATIVOS = ['periodo', 'dia']). Las altas de temporada cargadas
  // desde Clientes son filas de `reservas` pero no aparecen en /app/reservas,
  // así que "Ver Detalle" nunca las va a encontrar ahí — se excluyen acá.
  const recentReservas = reservas
    .filter((r) => r.tipo_alquiler === 'periodo' || r.tipo_alquiler === 'dia')
    .slice(0, 5)

  if (resLoading || cliLoading || cajaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Sincronizando PriusAdmin...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <KpiCard
          title="Ocupación Total"
          value={`${unidadesOcupadasCount} / ${unidades.length}`}
          subtitle="🏠 Carpas y ⛱️ sombrillas alquiladas"
          icon={Calendar}
          highlight
          progress={unidades.length > 0 ? { value: unidadesOcupadasCount, max: unidades.length } : null}
        />
        <KpiCard
          title="Caja Diaria"
          value={formatPesos(totalCajaHoy)}
          subtitle={cajaHoy ? 'Cobros registrados hoy' : 'Caja sin iniciar'}
          icon={Wallet}
          progress={mejorDiaCaja > 0 ? { value: totalCajaHoy, max: mejorDiaCaja } : null}
        />
        <KpiCard
          title="Saldos Pendientes"
          value={reservasConSaldoCount}
          subtitle="Cuentas con saldo deudor"
          icon={AlertCircle}
          progress={totalFacturado > 0 ? { value: totalPendiente, max: totalFacturado } : null}
        />
        <KpiCard
          title="Base de Clientes"
          value={clientesCount}
          subtitle="Clientes registrados"
          icon={Users}
        />
      </div>

      {/* Table Section — tabla en desktop, tarjetas en mobile (Tarea 4.3) */}
      <div className="glass-card p-4 sm:p-8 rounded-2xl glass-card-inner">
        <div className="flex justify-between items-center mb-4 sm:mb-8 gap-3">
          <h2 className="text-xs sm:text-sm font-bold tracking-[0.15em] sm:tracking-[0.2em] text-white uppercase truncate">Últimas reservas</h2>
          <button
            onClick={() => navigate('/app/reservas')}
            className="shrink-0 bg-[#FDE047] hover:bg-yellow-300 text-black text-[10px] sm:text-xs px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg transition-all flex items-center gap-2 font-bold uppercase tracking-wider"
          >
            Ver todas <ArrowRight size={14} />
          </button>
        </div>

        {recentReservas.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic text-sm">No se han registrado reservas recientemente.</p>
        ) : (
          <>
            {/* Mobile: tarjetas */}
            <div className="md:hidden space-y-3">
              {recentReservas.map((res) => (
                <button
                  key={res.id}
                  onClick={() => setDetalleReserva(res)}
                  className="w-full text-left p-4 min-h-[44px] bg-white/5 border border-white/10 rounded-xl flex flex-col gap-2 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{formatFecha(res.created_at)}</p>
                      <p className="font-bold text-white uppercase truncate">{res.clientes?.nombre || 'CLIENTE S/N'}</p>
                      <p className="text-xs text-gray-400 uppercase mt-0.5">
                        {unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero ?? 'N/A'}
                      </p>
                    </div>
                    <StatusBadge status={estadoBadgeStatus(res)} />
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: tabla */}
            <div className="hidden md:block overflow-x-auto">
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
                        {formatFecha(res.created_at)}
                      </td>
                      <td className="py-6 px-6 font-bold text-white uppercase tracking-tight">
                        {res.clientes?.nombre || 'CLIENTE S/N'}
                      </td>
                      <td className="py-6 px-6 uppercase">
                        {unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero ?? 'N/A'}
                      </td>
                      <td className="py-6 px-6">
                        <StatusBadge status={estadoBadgeStatus(res)} />
                      </td>
                      <td className="py-6 px-6 text-right">
                        <button
                          onClick={() => setDetalleReserva(res)}
                          className="text-[#FDE047] hover:text-white font-bold text-xs uppercase underline-offset-4 hover:underline transition-all"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* [feat-4] Recientes: últimos clientes/reservas que abrió este
          usuario, por usuario y entre dispositivos (vistas_recientes, sin
          localStorage). */}
      {recientesFeatureOn && recientes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Clock size={14} /> Recientes
          </h2>
          <div className="flex flex-wrap gap-2">
            {recientes.map((r) => (
              <button
                key={`${r.tipo}-${r.id}`}
                onClick={() => navigate(r.tipo === 'cliente' ? linkToCliente(r.id) : linkToReserva(r.id))}
                className="glass-card px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center gap-2"
              >
                {r.tipo === 'cliente' ? (
                  <>{r.cliente?.nombre || 'Cliente'}</>
                ) : (
                  <>{r.reserva?.clientes?.nombre || 'S/N'} · {unidadEmoji(r.reserva?.unidades?.tipo)} #{r.reserva?.unidades?.numero}</>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <ReservaDetalleModal reserva={detalleReserva} onClose={() => setDetalleReserva(null)} />
    </div>
  )
}
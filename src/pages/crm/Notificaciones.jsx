import React from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useCaja } from '../../hooks/useCaja'
import { AlertCircle, Calendar, Wallet } from 'lucide-react'

export default function Notificaciones() {
  const { reservas, loading: resLoading } = useReservas()
  const { cajaHoy, loading: cajaLoading } = useCaja()

  if (resLoading || cajaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-white/40">Cargando Alertas...</span>
      </div>
    )
  }

  // Generate alerts dynamically from database state
  const reservasConSaldo = reservas.filter(r => Number(r.saldo) > 0)
  
  const todayStr = new Date().toISOString().split('T')[0]
  const checkinsHoy = reservas.filter(r => r.fecha_inicio === todayStr)

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold text-white tracking-tight">Centro de Alertas y Notificaciones</h1>
        <p className="text-xs text-white/50 font-normal">Monitoreo automático de saldos pendientes, ingresos del día y arqueos.</p>
      </div>

      <div className="space-y-4">
        {/* Unclosed cashbox alert */}
        {!cajaHoy && (
          <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-2xl backdrop-blur-md flex items-start gap-3">
            <Wallet className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-xs font-bold text-amber-300 uppercase">Caja Diaria Pendiente de Inicio</h3>
              <p className="text-xs text-amber-200/80 mt-0.5">Recuerde iniciar la caja diaria desde el módulo de Caja para registrar cobros y gastos de hoy.</p>
            </div>
          </div>
        )}

        {/* Pending balance alerts */}
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <AlertCircle size={16} className="text-rose-400" />
            <span>Cuentas Corrientes con Saldo Pendiente ({reservasConSaldo.length})</span>
          </h2>

          <div className="divide-y divide-white/10">
            {reservasConSaldo.map(r => (
              <div key={r.id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold uppercase text-white">{r.clientes?.nombre || 'CLIENTE S/N'}</p>
                  <p className="text-[11px] text-white/50">
                    Unidad {r.unidades?.tipo} #{r.unidades?.numero} &bull; Teléfono: {r.clientes?.telefono || 'No registrado'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-rose-400">${r.saldo} pendiente</span>
                  <p className="text-[10px] text-white/35">Total: ${r.valor_total}</p>
                </div>
              </div>
            ))}
            {reservasConSaldo.length === 0 && (
              <p className="py-4 text-xs text-white/35 text-center">No hay clientes con saldos adeudados.</p>
            )}
          </div>
        </div>

        {/* Check-ins today alerts */}
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Calendar size={16} className="text-[#F2CA50]" />
            <span>Ingresos Programados para Hoy ({checkinsHoy.length})</span>
          </h2>

          <div className="divide-y divide-white/10">
            {checkinsHoy.map(r => (
              <div key={r.id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold uppercase text-white">{r.clientes?.nombre || 'CLIENTE S/N'}</p>
                  <p className="text-[11px] text-white/50">Unidad {r.unidades?.tipo} #{r.unidades?.numero}</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-xl uppercase">
                  Check-in Hoy
                </span>
              </div>
            ))}
            {checkinsHoy.length === 0 && (
              <p className="py-4 text-xs text-white/35 text-center">No hay inicios de estadía programados para hoy.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
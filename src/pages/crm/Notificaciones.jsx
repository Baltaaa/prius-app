import React from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useCaja } from '../../hooks/useCaja'
import { AlertCircle, Calendar, Wallet } from 'lucide-react'

export default function Notificaciones() {
  const { reservas, loading: resLoading } = useReservas()
  const { cajaHoy, loading: cajaLoading } = useCaja()

  if (resLoading || cajaLoading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Cargando Alertas...</span></div>

  const reservasConSaldo = reservas.filter(r => Number(r.saldo) > 0)
  const todayStr = new Date().toISOString().split('T')[0]
  const checkinsHoy = reservas.filter(r => r.fecha_inicio === todayStr)

  return (
    <div className="space-y-10 animate-premium-fade">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Notificaciones</h1>
        <p className="text-gray-400 text-sm mt-2">Alertas de sistema, saldos y operaciones diarias.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {!cajaHoy && (
          <div className="glass-card p-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Wallet className="text-yellow-500" size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Caja Pendiente</h3>
              <p className="text-xs text-gray-400 mt-1">Recuerde iniciar la caja diaria para registrar movimientos de hoy.</p>
            </div>
          </div>
        )}

        <div className="glass-card p-8 rounded-3xl glass-card-inner">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <AlertCircle size={20} className="text-red-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Saldos Pendientes ({reservasConSaldo.length})</h2>
          </div>
          <div className="space-y-4">
            {reservasConSaldo.map(r => (
              <div key={r.id} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <p className="text-xs font-bold uppercase text-white tracking-tight">{r.clientes?.nombre}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">{r.unidades?.tipo} #{r.unidades?.numero}</p>
                </div>
                <span className="text-sm font-bold text-red-400">${r.saldo}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl glass-card-inner">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <Calendar size={20} className="text-sky-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Check-ins de Hoy ({checkinsHoy.length})</h2>
          </div>
          <div className="space-y-4">
            {checkinsHoy.map(r => (
              <div key={r.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-white">{r.clientes?.nombre}</span>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-400/10 px-3 py-1 rounded-full uppercase tracking-wider">Ingreso Hoy</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
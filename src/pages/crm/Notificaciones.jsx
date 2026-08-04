import React from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useCaja } from '../../hooks/useCaja'
import { Bell, AlertCircle, Calendar, Wallet, CheckCircle2 } from 'lucide-react'

export default function Notificaciones() {
  const { reservas, loading: resLoading } = useReservas()
  const { cajaHoy, loading: cajaLoading } = useCaja()

  if (resLoading || cajaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-neutral-400">Cargando Alertas...</span>
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
      <div className="border-b border-[#E5E5E5] pb-4">
        <h1 className="text-xl font-bold text-black tracking-tight">Centro de Alertas y Notificaciones</h1>
        <p className="text-xs text-neutral-500 font-normal">Monitoreo automático de saldos pendientes, ingresos del día y arqueos.</p>
      </div>

      <div className="space-y-4">
        {/* Unclosed cashbox alert */}
        {!cajaHoy && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded flex items-start gap-3">
            <Wallet className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase">Caja Diaria Pendiente de Inicio</h3>
              <p className="text-xs text-amber-800 mt-0.5">Recuerde iniciar la caja diaria desde el módulo de Caja para registrar cobros y gastos de hoy.</p>
            </div>
          </div>
        )}

        {/* Pending balance alerts */}
        <div className="bg-white border border-[#E5E5E5] rounded p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2 pb-2 border-b border-[#E5E5E5]">
            <AlertCircle size={16} className="text-red-600" />
            <span>Cuentas Corrientes con Saldo Pendiente ({reservasConSaldo.length})</span>
          </h2>

          <div className="divide-y divide-[#E5E5E5]">
            {reservasConSaldo.map(r => (
              <div key={r.id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold uppercase text-black">{r.clientes?.nombre || 'CLIENTE S/N'}</p>
                  <p className="text-[11px] text-neutral-500">
                    Unidad {r.unidades?.tipo} #{r.unidades?.numero} &bull; Teléfono: {r.clientes?.telefono || 'No registrado'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-red-600">${r.saldo} pendiente</span>
                  <p className="text-[10px] text-neutral-400">Total: ${r.valor_total}</p>
                </div>
              </div>
            ))}
            {reservasConSaldo.length === 0 && (
              <p className="py-4 text-xs text-neutral-400 text-center">No hay clientes con saldos adeudados.</p>
            )}
          </div>
        </div>

        {/* Check-ins today alerts */}
        <div className="bg-white border border-[#E5E5E5] rounded p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2 pb-2 border-b border-[#E5E5E5]">
            <Calendar size={16} className="text-black" />
            <span>Ingresos Programados para Hoy ({checkinsHoy.length})</span>
          </h2>

          <div className="divide-y divide-[#E5E5E5]">
            {checkinsHoy.map(r => (
              <div key={r.id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold uppercase text-black">{r.clientes?.nombre || 'CLIENTE S/N'}</p>
                  <p className="text-[11px] text-neutral-500">Unidad {r.unidades?.tipo} #{r.unidades?.numero}</p>
                </div>
                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded uppercase">
                  Check-in Hoy
                </span>
              </div>
            ))}
            {checkinsHoy.length === 0 && (
              <p className="py-4 text-xs text-neutral-400 text-center">No hay inicios de estadía programados para hoy.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
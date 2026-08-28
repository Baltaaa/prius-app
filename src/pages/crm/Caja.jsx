import React, { useState } from 'react'
import { useCaja } from '../../hooks/useCaja'
import { Plus, Trash2, Wallet, Calendar, ArrowUpRight, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../../lib/format'

export default function Caja() {
  const { cajaHoy, historialCajas, gastos, loading, iniciarCaja, agregarGasto, eliminarGasto, cerrarCaja } = useCaja()
  const [descGasto, setDescGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Sincronizando Caja...</span></div>

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Caja Diaria</h1>
          <p className="text-gray-400 text-sm mt-2">Arqueo y control de movimientos financieros.</p>
        </div>
        {cajaHoy && (
          <span className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase border ${cajaHoy.cerrada ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
            {cajaHoy.cerrada ? 'Caja Cerrada' : 'Caja Abierta'}
          </span>
        )}
      </div>

      {!cajaHoy ? (
        <div className="glass-card p-20 text-center rounded-3xl glass-card-inner space-y-6">
          <div className="w-20 h-20 bg-[#FDE047]/10 rounded-full flex items-center justify-center mx-auto border border-[#FDE047]/20">
            <Wallet className="w-10 h-10 text-[#FDE047]" />
          </div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Caja no iniciada</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">Es necesario iniciar la caja del día para comenzar a registrar cobros y gastos.</p>
          <button onClick={iniciarCaja} className="bg-[#FDE047] hover:bg-yellow-300 text-black px-8 py-4 rounded-xl font-bold uppercase text-xs tracking-widest shadow-2xl transition-all">
            Abrir Caja de Hoy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-2xl glass-card-inner">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Ingresos Totales</p>
                <p className="text-2xl font-bold text-[#FDE047]">{formatCurrency(cajaHoy.total_cobros)}</p>
              </div>
              <div className="glass-card p-6 rounded-2xl glass-card-inner">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Gastos / Egresos</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(cajaHoy.total_gastos)}</p>
              </div>
              <div className="glass-card p-6 rounded-2xl bg-white/5 border border-white/20">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Neto en Caja</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(cajaHoy.total_neto)}</p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-3xl glass-card-inner">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-6">Registrar Egreso</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="DESCRIPCIÓN DEL GASTO"
                  value={descGasto}
                  onChange={(e) => setDescGasto(e.target.value.toUpperCase())}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FDE047]/50"
                />
                <input
                  type="number"
                  placeholder="MONTO"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FDE047]/50"
                />
                <button onClick={() => agregarGasto(descGasto, Number(montoGasto))} className="bg-white/10 hover:bg-white/20 text-white px-6 rounded-xl transition-all border border-white/10">
                  <Plus size={20} />
                </button>
              </div>

              <div className="mt-8 space-y-4">
                {gastos.map(g => (
                  <div key={g.id} className="flex justify-between items-center py-4 border-b border-white/5 last:border-0 group">
                    <span className="text-sm font-bold text-gray-300 uppercase">{g.descripcion}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-bold text-red-400">{formatCurrency(g.monto)}</span>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar el gasto "${g.descripcion}"?`)) eliminarGasto(g.id, g.monto) }}
                        className="text-gray-600 hover:text-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {!cajaHoy.cerrada && (
              <div className="glass-card p-8 rounded-3xl border border-red-500/20 bg-red-500/5">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Arqueo y Cierre</h3>
                <p className="text-gray-400 text-xs leading-relaxed mb-6">Una vez cerrada la caja, no podrá registrar más movimientos para esta fecha.</p>
                <button onClick={cerrarCaja} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-xl">
                  Cerrar Caja de Hoy
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
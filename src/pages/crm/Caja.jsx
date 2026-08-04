import React, { useState } from 'react'
import { useCaja } from '../../hooks/useCaja'
import { Plus, Trash2, Wallet, Calendar } from 'lucide-react'

export default function Caja() {
  const { cajaHoy, historialCajas, gastos, loading, iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja } = useCaja()

  // Form states for custom inputs
  const [efectivo, setEfectivo] = useState('')
  const [transferencias, setTransferencias] = useState('')
  const [digitales, setDigitales] = useState('')

  // Gasto manual
  const [descGasto, setDescGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  const handleUpdateValues = async (e) => {
    e.preventDefault()
    try {
      await actualizarCajaValores({
        efectivo: Number(efectivo || cajaHoy?.efectivo || 0),
        medio_pago_1: Number(transferencias || cajaHoy?.medio_pago_1 || 0),
        medio_pago_2: Number(digitales || cajaHoy?.medio_pago_2 || 0)
      })
      setEfectivo('')
      setTransferencias('')
      setDigitales('')
    } catch (err) {
      alert('Error actualizando valores de caja.')
    }
  }

  const handleAddGasto = async (e) => {
    e.preventDefault()
    if (!descGasto || !montoGasto) return
    try {
      await agregarGasto(descGasto, Number(montoGasto))
      setDescGasto('')
      setMontoGasto('')
    } catch (err) {
      alert('Error agregando gasto.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-white/40">Cargando Caja...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Caja Diaria y Gastos</h1>
          <p className="text-xs text-white/50 font-normal">Arqueo diario de cobros, transferencias y egresos directos.</p>
        </div>
        
        {cajaHoy && (
          <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold tracking-wider uppercase border ${cajaHoy.cerrada ? 'bg-rose-400/10 text-rose-400 border-rose-400/20' : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'}`}>
            {cajaHoy.cerrada ? 'CAJA CERRADA' : 'CAJA ABIERTA'}
          </span>
        )}
      </div>

      {/* Unopened state */}
      {!cajaHoy ? (
        <div className="p-12 text-center bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md space-y-4">
          <Calendar className="w-12 h-12 text-white/35 mx-auto" />
          <h2 className="text-sm uppercase font-bold text-white">Caja diaria no iniciada</h2>
          <p className="text-xs text-white/50 max-w-sm mx-auto">Debes iniciar la caja del día para registrar los movimientos financieros de hoy.</p>
          <button
            onClick={iniciarCaja}
            className="px-6 py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-full inline-flex items-center gap-2 transition-colors shadow-lg shadow-[#F2CA50]/10"
          >
            <Plus size={16} />
            Iniciar Caja Diaria
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Controls - Left panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Totals Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-semibold text-white/40 uppercase">Cobros de Hoy</span>
                <p className="text-xl font-bold mt-1 text-white">{formatCurrency(cajaHoy.total_cobros)}</p>
              </div>
              <div className="p-4 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-semibold text-white/40 uppercase">Gastos de Hoy</span>
                <p className="text-xl font-bold mt-1 text-rose-400">{formatCurrency(cajaHoy.total_gastos)}</p>
              </div>
              <div className="p-4 border border-white/10 bg-black/60 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-semibold text-white/50 uppercase">Caja Neta</span>
                <p className="text-xl font-bold mt-1 text-[#F2CA50]">{formatCurrency(cajaHoy.total_neto)}</p>
              </div>
            </div>

            {/* Inputs grid if not closed */}
            {!cajaHoy.cerrada ? (
              <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md space-y-4">
                <h3 className="text-xs font-bold uppercase text-white/70">Actualizar Medios de Pago</h3>
                <form onSubmit={handleUpdateValues} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/50 uppercase">Efectivo ($)</label>
                    <input
                      type="number"
                      placeholder={cajaHoy.efectivo}
                      value={efectivo}
                      onChange={(e) => setEfectivo(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/50 uppercase">Transferencias ($)</label>
                    <input
                      type="number"
                      placeholder={cajaHoy.medio_pago_1}
                      value={transferencias}
                      onChange={(e) => setTransferencias(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/50 uppercase">Tarjeta/Digital ($)</label>
                    <input
                      type="number"
                      placeholder={cajaHoy.medio_pago_2}
                      value={digitales}
                      onChange={(e) => setDigitales(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold placeholder:text-white/30"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-full sm:col-span-3 transition-colors"
                  >
                    Guardar Totales de Cobro
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center text-xs text-white/50">
                La caja de hoy está cerrada y archivada.
              </div>
            )}

            {/* Expenses segment */}
            <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md space-y-4">
              <h3 className="text-xs font-bold uppercase text-white/70">Gastos Registrados</h3>
              
              {!cajaHoy.cerrada && (
                <form onSubmit={handleAddGasto} className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="DESCRIPCIÓN DEL GASTO"
                      value={descGasto}
                      onChange={(e) => setDescGasto(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/35 text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold"
                    />
                  </div>
                  <div className="w-full sm:w-36 space-y-1">
                    <input
                      type="number"
                      required
                      placeholder="MONTO ($)"
                      value={montoGasto}
                      onChange={(e) => setMontoGasto(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/35 text-xs focus:border-[#F2CA50] outline-none rounded-xl font-semibold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-full inline-flex items-center gap-2 shrink-0 h-9 transition-colors"
                  >
                    <Plus size={14} /> Registrar
                  </button>
                </form>
              )}

              {/* Expenses list display */}
              <div className="divide-y divide-white/10 text-xs">
                {gastos.map((g) => (
                  <div key={g.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-semibold uppercase text-white">{g.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-rose-400">{formatCurrency(g.monto)}</span>
                      {!cajaHoy.cerrada && (
                        <button
                          onClick={() => eliminarGasto(g.id, g.monto)}
                          className="text-white/35 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {gastos.length === 0 && (
                  <p className="py-3 text-center text-xs text-white/35">Sin gastos registrados hoy.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar inside Caja */}
          <div className="space-y-6">
            {!cajaHoy.cerrada && (
              <div className="p-5 border border-rose-400/20 bg-rose-400/10 rounded-2xl backdrop-blur-md space-y-3">
                <h3 className="text-xs uppercase font-bold text-rose-400">Arqueo y Cierre</h3>
                <p className="text-xs text-rose-300/80 leading-normal">Al cerrar la caja de hoy, no se podrán agregar más movimientos financieros.</p>
                <button
                  onClick={() => {
                    if (confirm('¿Está seguro de cerrar la caja de hoy?')) {
                      cerrarCaja()
                    }
                  }}
                  className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider rounded-full transition-colors"
                >
                  Cerrar Caja de Hoy
                </button>
              </div>
            )}

            {/* General History list */}
            <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md space-y-4">
              <h3 className="text-xs font-bold uppercase text-white/70">Historial Reciente</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
                {historialCajas.map((hist) => (
                  <div key={hist.id} className="p-3 border border-white/10 hover:bg-white/5 rounded-xl flex justify-between items-center transition-colors">
                    <div>
                      <p className="font-bold text-white">{hist.fecha}</p>
                      <span className={`text-[10px] font-bold ${hist.cerrada ? 'text-white/35' : 'text-emerald-400'}`}>
                        {hist.cerrada ? 'CERRADA' : 'ABIERTA'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">{formatCurrency(hist.total_neto)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
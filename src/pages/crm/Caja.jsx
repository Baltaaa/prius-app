import React, { useState } from 'react'
import { useCaja } from '../../hooks/useCaja'
import { Plus, Trash2, Wallet, DollarSign, Calendar } from 'lucide-react'

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
      <div className="flex items-center justify-center h-full">
        <span className="text-xs uppercase tracking-widest font-semibold text-neutral-400">Cargando Caja...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl uppercase tracking-wider font-extrabold font-display">Caja Diaria</h1>
          <p className="text-xs text-neutral-500">Manejo de ingresos diarios por reservas, cobros directos y gastos menores.</p>
        </div>
        
        {cajaHoy && (
          <span className={`inline-flex items-center px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${cajaHoy.cerrada ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {cajaHoy.cerrada ? 'CAJA CERRADA' : 'CAJA ABIERTA'}
          </span>
        )}
      </div>

      {/* Unopened state */}
      {!cajaHoy ? (
        <div className="p-12 text-center bg-white border border-[#E5E5E5] space-y-4">
          <Calendar className="w-12 h-12 text-neutral-400 mx-auto" />
          <h2 className="text-xs uppercase font-bold tracking-wider text-black font-display">La caja para hoy no está iniciada</h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">Debes iniciar la caja diaria para registrar los cobros y balancear los gastos de la fecha actual.</p>
          <button
            onClick={iniciarCaja}
            className="px-6 py-3 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Iniciar Caja Diaria
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Controls - Left and Mid panels */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Totals Balance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 border border-[#E5E5E5] bg-white">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-display">Cobros de Hoy</span>
                <p className="text-xl font-bold mt-1 text-black">{formatCurrency(cajaHoy.total_cobros)}</p>
              </div>
              <div className="p-5 border border-[#E5E5E5] bg-white">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-display">Gastos de Hoy</span>
                <p className="text-xl font-bold mt-1 text-red-600">{formatCurrency(cajaHoy.total_gastos)}</p>
              </div>
              <div className="p-5 border border-[#E5E5E5] bg-black text-white">
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest font-display">Caja Neta</span>
                <p className="text-xl font-bold mt-1 text-[#F2CA50]">{formatCurrency(cajaHoy.total_neto)}</p>
              </div>
            </div>

            {/* Inputs grid if not closed */}
            {!cajaHoy.cerrada ? (
              <div className="p-6 border border-[#E5E5E5] bg-white space-y-4">
                <h3 className="text-xs uppercase font-bold tracking-wider font-display text-neutral-500">Actualizar Medios de Pago</h3>
                <form onSubmit={handleUpdateValues} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Efectivo ($)</label>
                    <input
                      type="number"
                      placeholder={cajaHoy.efectivo}
                      value={efectivo}
                      onChange={(e) => setEfectivo(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E5E5] text-xs focus:border-black outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Transferencias ($)</label>
                    <input
                      type="number"
                      placeholder={cajaHoy.medio_pago_1}
                      value={transferencias}
                      onChange={(e) => setTransferencias(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E5E5] text-xs focus:border-black outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Tarjeta/Digital ($)</label>
                    <input
                      type="number"
                      placeholder={cajaHoy.medio_pago_2}
                      value={digitales}
                      onChange={(e) => setDigitales(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E5E5] text-xs focus:border-black outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-black hover:bg-black/90 text-white font-bold text-xs uppercase tracking-widest rounded-sm col-span-1 sm:col-span-3"
                  >
                    Guardar Totales de Cobro
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-6 bg-neutral-100 border border-neutral-200 text-center text-xs uppercase tracking-wider text-neutral-500">
                La caja de hoy está cerrada y archivada para auditoría. No se permiten más modificaciones.
              </div>
            )}

            {/* Expenses segment */}
            <div className="p-6 border border-[#E5E5E5] bg-white space-y-4">
              <h3 className="text-xs uppercase font-bold tracking-wider font-display text-neutral-500">Gastos Registrados</h3>
              
              {!cajaHoy.cerrada && (
                <form onSubmit={handleAddGasto} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="DESCRIPCIÓN DEL GASTO (E.G. COMPRA REPOSERAS)"
                      value={descGasto}
                      onChange={(e) => setDescGasto(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-[#E5E5E5] text-xs focus:border-black outline-none"
                    />
                  </div>
                  <div className="w-full sm:w-40 space-y-1">
                    <input
                      type="number"
                      required
                      placeholder="MONTO ($)"
                      value={montoGasto}
                      onChange={(e) => setMontoGasto(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E5E5] text-xs focus:border-black outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-sm inline-flex items-center gap-2 shrink-0 h-10"
                  >
                    <Plus size={14} /> Registrar Gasto
                  </button>
                </form>
              )}

              {/* Expenses list display */}
              <div className="divide-y divide-[#E5E5E5] text-xs">
                {gastos.map((g) => (
                  <div key={g.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold uppercase text-black">{g.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-red-600">{formatCurrency(g.monto)}</span>
                      {!cajaHoy.cerrada && (
                        <button
                          onClick={() => eliminarGasto(g.id, g.monto)}
                          className="text-neutral-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {gastos.length === 0 && (
                  <p className="py-3 text-center text-[10px] text-neutral-400 uppercase">Sin gastos registrados para hoy.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar inside Caja: Action close & History list */}
          <div className="space-y-6">
            
            {/* Close caja Action */}
            {!cajaHoy.cerrada && (
              <div className="p-6 border border-[#E5E5E5] bg-red-50 space-y-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider font-display text-red-700">Arqueo y Cierre</h3>
                <p className="text-[11px] text-red-600/80 leading-normal">Una vez cerrada la caja, no podrás agregar cobros o gastos para el día de hoy. El neto se archivará permanentemente.</p>
                <button
                  onClick={() => {
                    if (confirm('¿Está totalmente seguro de realizar el arqueo y cerrar la caja de hoy?')) {
                      cerrarCaja()
                    }
                  }}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-sm"
                >
                  Cerrar Caja de Hoy
                </button>
              </div>
            )}

            {/* General History list */}
            <div className="p-6 border border-[#E5E5E5] bg-white space-y-4">
              <h3 className="text-xs uppercase font-bold tracking-wider font-display text-neutral-500">Historial de Caja</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
                {historialCajas.map((hist) => (
                  <div key={hist.id} className="p-3 border border-[#E5E5E5] hover:bg-neutral-50 flex justify-between items-center">
                    <div>
                      <p className="font-bold">{hist.fecha}</p>
                      <span className={`text-[8px] font-bold ${hist.cerrada ? 'text-neutral-400' : 'text-green-600'}`}>
                        {hist.cerrada ? 'CERRADA' : 'ABIERTA'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-black">{formatCurrency(hist.total_neto)}</p>
                      <p className="text-[9px] text-neutral-400 uppercase">Cobros: {formatCurrency(hist.total_cobros)}</p>
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
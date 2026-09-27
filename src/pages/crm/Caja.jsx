import React, { useState, useMemo } from 'react'
import { useCaja } from '../../hooks/useCaja'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { Plus, Trash2, Wallet, ChevronLeft, ChevronRight, Banknote, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatCurrency, formatDate } from '../../lib/format'
import { useDialog } from '../../context/DialogProvider'

const FILTROS_MEDIO = [
  { value: 'todos', label: 'Todos los medios' },
  ...Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({ value, label })),
]

const todayStr = () => new Date().toISOString().split('T')[0]

// Suma/resta un día a una fecha yyyy-mm-dd sin líos de timezone.
const shiftDate = (fecha, delta) => {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().split('T')[0]
}

export default function Caja() {
  const {
    cajaHoy, historialCajas, todosGastos, ingresosCaja, loading,
    iniciarCaja, agregarGasto, eliminarGasto, cerrarCaja,
  } = useCaja()
  const { confirm } = useDialog()
  const [descGasto, setDescGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [filtroMedio, setFiltroMedio] = useState('todos')

  // Un solo lookup fecha -> caja_diaria. cajaHoy se mantiene aparte (con
  // updates optimistas) y puede no estar todavía en historialCajas si recién
  // se creó, así que se prioriza.
  const cajaPorFecha = useMemo(() => {
    const map = {}
    for (const c of historialCajas) map[c.fecha] = c
    if (cajaHoy) map[cajaHoy.fecha] = cajaHoy
    return map
  }, [historialCajas, cajaHoy])

  const esHoy = selectedDate === todayStr()
  const cajaSeleccionada = cajaPorFecha[selectedDate] || null

  const ingresosDia = useMemo(
    () => (cajaSeleccionada ? ingresosCaja.filter((i) => i.caja_id === cajaSeleccionada.id) : []),
    [ingresosCaja, cajaSeleccionada],
  )
  const gastosDia = useMemo(
    () => (cajaSeleccionada ? todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id) : []),
    [todosGastos, cajaSeleccionada],
  )
  const ingresosFiltrados = useMemo(
    () => (filtroMedio === 'todos' ? ingresosDia : ingresosDia.filter((i) => i.medio === filtroMedio)),
    [ingresosDia, filtroMedio],
  )

  // Movimientos del día, ingresos (por pago, cruce automático) + egresos
  // manuales (gastos_caja), mezclados en un solo feed cronológico.
  const movimientos = useMemo(() => {
    const ing = ingresosFiltrados.map((i) => ({ ...i, tipo: 'ingreso', fechaHora: i.created_at }))
    const egr = gastosDia.map((g) => ({ ...g, tipo: 'egreso', fechaHora: g.created_at }))
    return [...ing, ...egr].sort((a, b) => (b.fechaHora || '').localeCompare(a.fechaHora || ''))
  }, [ingresosFiltrados, gastosDia])

  // Arqueo real: billete físico (efectivo) nunca se mezcla con medios no
  // físicos (tarjeta/transferencia) — Task crítica de esta sesión.
  const efectivoFisico = useMemo(() => {
    const manual = Number(cajaSeleccionada?.efectivo || 0)
    const deIngresos = ingresosDia.filter((i) => i.es_efectivo).reduce((acc, i) => acc + Number(i.monto), 0)
    return manual + deIngresos
  }, [cajaSeleccionada, ingresosDia])

  const noFisico = useMemo(() => {
    const manual = Number(cajaSeleccionada?.medio_pago_1 || 0) + Number(cajaSeleccionada?.medio_pago_2 || 0)
    const deIngresos = ingresosDia.filter((i) => !i.es_efectivo).reduce((acc, i) => acc + Number(i.monto), 0)
    return manual + deIngresos
  }, [cajaSeleccionada, ingresosDia])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Sincronizando Caja...</span></div>

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Navegación por fecha + estado de caja (izquierda) y filtro de medio
          (derecha), todo en una sola fila pegada al navbar. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
          title="Día anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={todayStr()}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none [color-scheme:dark]"
        />
        <button
          onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
          disabled={esHoy}
          className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-xl text-gray-300 transition-all"
          title="Día siguiente"
        >
          <ChevronRight size={16} />
        </button>
        {!esHoy && (
          <button
            onClick={() => setSelectedDate(todayStr())}
            className="px-4 py-3 bg-[#FDE047]/10 hover:bg-[#FDE047]/20 border border-[#FDE047]/20 rounded-xl text-[#FDE047] text-xs font-bold uppercase tracking-widest transition-all"
          >
            Volver a Hoy
          </button>
        )}
        {cajaSeleccionada && (
          <span className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase border ${cajaSeleccionada.cerrada ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
            {cajaSeleccionada.cerrada ? 'Caja Cerrada' : 'Caja Abierta'}
          </span>
        )}
        <div className="flex-1" />
        <select
          value={filtroMedio}
          onChange={(e) => setFiltroMedio(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs uppercase font-bold focus:border-[#FDE047]/50 outline-none"
        >
          {FILTROS_MEDIO.map((f) => (
            <option key={f.value} value={f.value} className="bg-[#0a0d14]">{f.label}</option>
          ))}
        </select>
      </div>

      {!cajaSeleccionada ? (
        esHoy ? (
          <div className="glass-card p-20 text-center rounded-3xl glass-card-inner space-y-6">
            <div className="w-20 h-20 bg-[#FDE047]/10 rounded-full flex items-center justify-center mx-auto border border-[#FDE047]/20">
              <Wallet className="w-10 h-10 text-[#FDE047]" />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Caja no iniciada</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">Es necesario iniciar la caja del día para comenzar a registrar cobros y gastos. También se abre solo apenas se registra el primer pago.</p>
            <button onClick={iniciarCaja} className="bg-[#FDE047] hover:bg-yellow-300 text-black px-8 py-4 rounded-xl font-bold uppercase text-xs tracking-widest shadow-2xl transition-all">
              Abrir Caja de Hoy
            </button>
          </div>
        ) : (
          <div className="glass-card p-20 text-center rounded-3xl glass-card-inner">
            <p className="text-gray-400 text-sm uppercase tracking-widest font-bold">Sin movimientos registrados este día.</p>
          </div>
        )
      ) : (
        <>
          {/* Apertura / Ingresos / Egresos / Cierre */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card p-6 rounded-2xl glass-card-inner">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Apertura</p>
              <p className={`text-xl font-bold ${Number(cajaSeleccionada.saldo_apertura) < 0 ? 'text-red-400' : 'text-white'}`}>
                {formatCurrency(cajaSeleccionada.saldo_apertura)}
              </p>
            </div>
            <div className="glass-card p-6 rounded-2xl glass-card-inner">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Ingresos</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(cajaSeleccionada.total_cobros)}</p>
            </div>
            <div className="glass-card p-6 rounded-2xl glass-card-inner">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Egresos</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(cajaSeleccionada.total_gastos)}</p>
            </div>
            <div className="glass-card p-6 rounded-2xl bg-white/5 border border-white/20">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cierre</p>
              <p className="text-xl font-bold text-white">{formatCurrency(cajaSeleccionada.total_neto)}</p>
            </div>
          </div>

          {/* Arqueo: físico vs no físico, nunca mezclados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-2xl border border-green-500/20 bg-green-500/5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <Banknote className="text-green-400" size={22} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-green-400/80 uppercase tracking-widest">Efectivo Físico (arqueo de billetes)</p>
                <p className="text-xl font-bold text-white">{formatCurrency(efectivoFisico)}</p>
              </div>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <CreditCard className="text-gray-300" size={22} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">No Físico (tarjeta / transferencia)</p>
                <p className="text-xl font-bold text-white">{formatCurrency(noFisico)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Movimientos del día: ingresos (cruce automático de pagos) + egresos */}
              <div className="glass-card p-8 rounded-3xl glass-card-inner">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-6">
                  Movimientos del Día ({movimientos.length})
                </h3>
                {movimientos.length === 0 ? (
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Sin movimientos con este filtro.</p>
                ) : (
                  <div className="space-y-3">
                    {movimientos.map((m) => (
                      <div key={`${m.tipo}-${m.id}`} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0 group">
                        <div className="flex items-center gap-3">
                          {m.tipo === 'ingreso' ? (
                            <ArrowUpRight size={16} className="text-green-400 shrink-0" />
                          ) : (
                            <ArrowDownRight size={16} className="text-red-400 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-bold text-gray-200 uppercase">
                              {m.tipo === 'ingreso' ? (m.concepto || 'Ingreso') : m.descripcion}
                            </p>
                            {m.tipo === 'ingreso' && (
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                {MEDIO_PAGO_LABEL[m.medio] || m.medio}
                                {m.es_efectivo ? (
                                  <span className="text-green-400">· Físico</span>
                                ) : (
                                  <span className="text-gray-400">· No físico</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-bold ${m.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                            {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                          </span>
                          {m.tipo === 'egreso' && esHoy && (
                            <button
                              onClick={async () => {
                                const ok = await confirm(`¿Eliminar el gasto "${m.descripcion}"?`, { title: 'Eliminar gasto' })
                                if (ok) eliminarGasto(m.id, m.monto)
                              }}
                              className="text-gray-600 hover:text-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alta de egreso manual — solo para el día de hoy */}
              {esHoy && (
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
                    <button
                      onClick={() => { agregarGasto(descGasto, Number(montoGasto)); setDescGasto(''); setMontoGasto('') }}
                      className="bg-white/10 hover:bg-white/20 text-white px-6 rounded-xl transition-all border border-white/10"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-8">
              {esHoy && !cajaSeleccionada.cerrada && (
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
        </>
      )}
    </div>
  )
}

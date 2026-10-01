import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useCaja } from '../../hooks/useCaja'
import { useData } from '../../context/DataProvider'
import { supabase } from '../../lib/supabase'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import MoneyInput from '../../components/inputs/MoneyInput'
import DateInput from '../../components/inputs/DateInput'

const MAX_MONTO_INICIAL = 10_000_000
import { CATEGORIA_GASTO_LABEL, formatHora, descargarCajaCSV } from '../../lib/caja'
import {
  Plus, Wallet, ChevronLeft, ChevronRight, Banknote,
  ArrowUpRight, ArrowDownRight, Printer, Download, Lock, History, AlertTriangle, X,
} from 'lucide-react'
import { formatPesos, formatFecha } from '../../lib/format'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import RegistrarGasto from '../../components/crm/RegistrarGasto'
import DetalleGasto from '../../components/crm/DetalleGasto'
import DetallePago from '../../components/crm/DetallePago'
import ResumenCaja from '../../components/crm/ResumenCaja'
import CajaImpresion from '../../components/crm/CajaImpresion'
import CerrarCajaStepper from '../../components/crm/CerrarCajaStepper'

const FILTROS_MEDIO = [
  { value: 'todos', label: 'Todos los medios' },
  ...Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({ value, label })),
]

const TABS = [
  { value: 'movimientos', label: 'Movimientos' },
  { value: 'facturas', label: 'Facturas' },
  { value: 'recibos', label: 'Recibos' },
  { value: 'sin_comprobante', label: 'Sin comprobante' },
  { value: 'gastos', label: 'Gastos' },
]

const todayStr = () => new Date().toISOString().split('T')[0]

const shiftDate = (fecha, delta) => {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().split('T')[0]
}

export default function Caja() {
  const { cajaHoy, historialCajas, todosGastos, loading, iniciarCaja, cerrarCaja, reabrirCaja } = useCaja()
  const puedeReabrir = usePermiso('reabrir_caja')
  const { pagos } = useData()
  const { alert } = useDialog()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [filtroMedio, setFiltroMedio] = useState('todos')
  const [tab, setTab] = useState('movimientos')
  const [montoApertura, setMontoApertura] = useState(null)
  const [abriendo, setAbriendo] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [mostrarGasto, setMostrarGasto] = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null)
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null)
  const [reabriendo, setReabriendo] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState('')

  const [resumen, setResumen] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [resumenLoading, setResumenLoading] = useState(false)

  const cajaPorFecha = useMemo(() => {
    const map = {}
    for (const c of historialCajas) map[c.fecha] = c
    if (cajaHoy) map[cajaHoy.fecha] = cajaHoy
    return map
  }, [historialCajas, cajaHoy])

  const esHoy = selectedDate === todayStr()
  const cajaSeleccionada = cajaPorFecha[selectedDate] || null

  // Fuente única de verdad: pantalla, impresión y CSV parten siempre del
  // mismo resumen_caja(caja_id) — si la caja está cerrada se usa el
  // resumen_snapshot congelado al cerrar (no se recalcula), si está abierta
  // se pide en vivo y se refresca con cada cambio de totales.
  const cargarResumen = useCallback(async (caja) => {
    if (!caja) { setResumen(null); setMovimientos([]); return }
    if (caja.estado === 'cerrada' && caja.resumen_snapshot) {
      setResumen(caja.resumen_snapshot)
    } else {
      setResumenLoading(true)
      const { data } = await supabase.rpc('resumen_caja', { p_caja_id: caja.id })
      setResumen(data || null)
      setResumenLoading(false)
    }
    const { data: mov } = await supabase
      .from('v_caja_movimientos')
      .select('*')
      .eq('caja_id', caja.id)
      .order('fecha_hora', { ascending: false })
    setMovimientos(mov || [])
  }, [])

  useEffect(() => {
    cargarResumen(cajaSeleccionada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaSeleccionada?.id, cajaSeleccionada?.total_cobros, cajaSeleccionada?.total_gastos, cajaSeleccionada?.estado])

  const movimientosFiltrados = useMemo(
    () => (filtroMedio === 'todos' ? movimientos : movimientos.filter((m) => m.medio_pago === filtroMedio)),
    [movimientos, filtroMedio],
  )

  const efectivoEsperadoPreview = resumen?.arqueo?.esperado ?? 0

  const errorMontoApertura =
    montoApertura != null && montoApertura > MAX_MONTO_INICIAL
      ? `El monto inicial no puede superar ${formatPesos(MAX_MONTO_INICIAL)}`
      : null

  const handleAbrirCaja = async () => {
    if (errorMontoApertura) return
    setAbriendo(true)
    try {
      await iniciarCaja(montoApertura || 0)
      setMontoApertura(null)
    } catch (err) {
      await alert(err.message || 'No se pudo abrir la caja.')
    } finally {
      setAbriendo(false)
    }
  }

  const handleCerrarCaja = async ({ efectivoContado, observaciones, datosZ }) => {
    try {
      await cerrarCaja(cajaSeleccionada.id, efectivoContado, datosZ, observaciones)
    } catch (err) {
      await alert(err.message || 'No se pudo cerrar la caja.')
      throw err
    }
  }

  const handleReabrir = async () => {
    if (!motivoReapertura.trim()) return
    try {
      await reabrirCaja(cajaSeleccionada.id, motivoReapertura.trim())
      setReabriendo(false)
      setMotivoReapertura('')
    } catch (err) {
      await alert(err.message || 'No se pudo reabrir la caja.')
    }
  }

  const abrirDetalleMovimiento = (m) => {
    if (m.tipo_movimiento === 'ingreso') {
      const pago = pagos.find((p) => p.id === m.movimiento_id)
      if (pago) setPagoSeleccionado(pago)
    } else {
      const gasto = todosGastos.find((g) => g.id === m.movimiento_id)
      if (gasto) setGastoSeleccionado(gasto)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Sincronizando Caja...</span></div>

  return (
    <div className="space-y-8 animate-premium-fade">
      {/* Barra de navegación por fecha + historial */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <button onClick={() => setSelectedDate((d) => shiftDate(d, -1))} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all min-w-[44px] min-h-[44px]" title="Día anterior">
          <ChevronLeft size={16} />
        </button>
        <DateInput value={selectedDate} onChange={(v) => v && setSelectedDate(v)} max={todayStr()} className="w-36" />
        <button onClick={() => setSelectedDate((d) => shiftDate(d, 1))} disabled={esHoy} className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-xl text-gray-300 transition-all min-w-[44px] min-h-[44px]" title="Día siguiente">
          <ChevronRight size={16} />
        </button>
        {!esHoy && (
          <button onClick={() => setSelectedDate(todayStr())} className="px-4 py-3 bg-[#FDE047]/10 hover:bg-[#FDE047]/20 border border-[#FDE047]/20 rounded-xl text-[#FDE047] text-xs font-bold uppercase tracking-widest transition-all">
            Volver a Hoy
          </button>
        )}
        {cajaSeleccionada && (
          <span className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase border ${cajaSeleccionada.estado === 'cerrada' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
            {cajaSeleccionada.estado === 'cerrada' ? 'Caja Cerrada' : 'Caja Abierta'}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setMostrarHistorial((v) => !v)}
          className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-xs font-bold uppercase tracking-widest transition-all min-h-[44px]"
        >
          <History size={14} /> Historial
        </button>
      </div>

      {mostrarHistorial && (
        <div className="no-print glass-card p-6 rounded-2xl glass-card-inner space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Historial de cajas</h3>
          {historialCajas.length === 0 ? (
            <p className="text-xs text-gray-500 uppercase tracking-widest">Sin cajas registradas todavía.</p>
          ) : historialCajas.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedDate(c.fecha); setMostrarHistorial(false) }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-left"
            >
              <span className="text-sm text-gray-300">{formatFecha(c.fecha)}</span>
              <span className="flex items-center gap-4 text-xs">
                <span className="font-bold text-white tabular-nums">{formatPesos(c.total_neto)}</span>
                {c.diferencia != null && Number(c.diferencia) !== 0 && (
                  <span className="text-[#FDE047] tabular-nums">dif. {formatPesos(c.diferencia)}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Estado A: sin caja */}
      {!cajaSeleccionada && (
        esHoy ? (
          <div className="no-print glass-card p-20 text-center rounded-3xl glass-card-inner space-y-6">
            <div className="w-20 h-20 bg-[#FDE047]/10 rounded-full flex items-center justify-center mx-auto border border-[#FDE047]/20">
              <Wallet className="w-10 h-10 text-[#FDE047]" />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Caja no iniciada</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">Abrí la caja del día para empezar a registrar cobros y gastos.</p>
            <div className="max-w-xs mx-auto space-y-4 text-left">
              <MoneyInput
                label="Monto inicial"
                value={montoApertura}
                onChange={setMontoApertura}
                error={errorMontoApertura}
                max={MAX_MONTO_INICIAL}
              />
              <button
                onClick={handleAbrirCaja}
                disabled={abriendo || !!errorMontoApertura}
                className="w-full bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black px-8 py-4 rounded-xl font-bold uppercase text-xs tracking-widest shadow-2xl transition-all"
              >
                {abriendo ? 'Abriendo...' : 'Abrir Caja de Hoy'}
              </button>
            </div>
          </div>
        ) : (
          <div className="no-print glass-card p-20 text-center rounded-3xl glass-card-inner">
            <p className="text-gray-400 text-sm uppercase tracking-widest font-bold">Sin movimientos registrados este día.</p>
          </div>
        )
      )}

      {/* Estado B: caja abierta (en vivo) */}
      {cajaSeleccionada && cajaSeleccionada.estado === 'abierta' && (
        <>
          <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl glass-card-inner">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Ingresos</p>
              <p className="text-xl font-bold text-green-400 tabular-nums">{formatPesos(cajaSeleccionada.total_cobros)}</p>
            </div>
            <div className="glass-card p-5 rounded-2xl glass-card-inner">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Egresos</p>
              <p className="text-xl font-bold text-red-400 tabular-nums">{formatPesos(cajaSeleccionada.total_gastos)}</p>
            </div>
            <div className="glass-card p-5 rounded-2xl glass-card-inner border border-[#FDE047]/20">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Neto</p>
              <p className="text-xl font-bold text-[#FDE047] tabular-nums">{formatPesos(cajaSeleccionada.total_neto)}</p>
            </div>
            <div className="glass-card p-5 rounded-2xl glass-card-inner flex items-center gap-3">
              <Banknote className="text-green-400 shrink-0" size={20} />
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Efectivo esperado</p>
                <p className="text-lg font-bold text-white tabular-nums">{formatPesos(efectivoEsperadoPreview)}</p>
              </div>
            </div>
          </div>

          {(resumen?.por_medio?.length > 0) && (
            <div className="no-print flex flex-wrap gap-3">
              {resumen.por_medio.map((m) => (
                <div key={m.medio} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs flex items-center gap-2">
                  <span className="text-gray-400">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                  <span className="font-bold text-white tabular-nums">{formatPesos(m.neto)}</span>
                </div>
              ))}
            </div>
          )}

          {resumen?.sin_comprobante?.length > 0 && (
            <div className="no-print flex items-start gap-3 p-4 bg-[#FDE047]/5 border border-[#FDE047]/20 rounded-xl">
              <AlertTriangle className="text-[#FDE047] shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-gray-300">
                Hay {resumen.sin_comprobante.length} pago{resumen.sin_comprobante.length > 1 ? 's' : ''} sin comprobante cargado todavía.
              </p>
            </div>
          )}

          <div className="no-print space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all min-h-[44px] ${
                    tab === t.value ? 'bg-[#FDE047] text-black' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="flex-1" />
              {tab === 'movimientos' && (
                <select value={filtroMedio} onChange={(e) => setFiltroMedio(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs uppercase font-bold focus:border-[#FDE047]/50 outline-none">
                  {FILTROS_MEDIO.map((f) => <option key={f.value} value={f.value} className="bg-[#0a0d14]">{f.label}</option>)}
                </select>
              )}
            </div>

            <div className="glass-card p-6 sm:p-8 rounded-3xl glass-card-inner">
              {tab === 'movimientos' && (
                movimientosFiltrados.length === 0 ? (
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Sin movimientos con este filtro.</p>
                ) : (
                  <div className="space-y-2">
                    {movimientosFiltrados.map((m) => (
                      <button
                        key={`${m.tipo_movimiento}-${m.movimiento_id}`}
                        onClick={() => abrirDetalleMovimiento(m)}
                        className={`w-full flex justify-between items-center py-3 px-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-all text-left ${m.estado === 'anulado' ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {m.tipo_movimiento === 'ingreso' ? <ArrowUpRight size={16} className="text-green-400 shrink-0" /> : <ArrowDownRight size={16} className="text-red-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className={`text-sm font-bold text-gray-200 truncate ${m.estado === 'anulado' ? 'line-through' : ''}`}>{m.concepto}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{m.cliente_proveedor} · {MEDIO_PAGO_LABEL[m.medio_pago] || m.medio_pago} · {formatHora(m.fecha_hora)}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${m.monto < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatPesos(m.monto)}</span>
                      </button>
                    ))}
                  </div>
                )
              )}

              {tab === 'facturas' && (
                (resumen?.facturas || []).length === 0 ? <p className="text-xs text-gray-500 uppercase tracking-widest">Sin facturas todavía.</p> : (
                  <div className="space-y-2">
                    {resumen.facturas.map((f) => (
                      <div key={f.etiqueta} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-sm text-gray-300">{f.etiqueta}</span>
                        <span className="text-sm font-bold text-white tabular-nums">{formatPesos(f.monto_total)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'recibos' && (
                (resumen?.recibos || []).length === 0 ? <p className="text-xs text-gray-500 uppercase tracking-widest">Sin recibos todavía.</p> : (
                  <div className="space-y-2">
                    {resumen.recibos.map((r) => (
                      <div key={r.etiqueta} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-sm text-gray-300">{r.etiqueta}</span>
                        <span className="text-sm font-bold text-white tabular-nums">{formatPesos(r.monto_total)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'sin_comprobante' && (
                (resumen?.sin_comprobante || []).length === 0 ? <p className="text-xs text-gray-500 uppercase tracking-widest">Todos los pagos tienen comprobante.</p> : (
                  <div className="space-y-2">
                    {resumen.sin_comprobante.map((p) => (
                      <button
                        key={p.pago_id}
                        onClick={() => { const pago = pagos.find((x) => x.id === p.pago_id); if (pago) setPagoSeleccionado(pago) }}
                        className="w-full flex justify-between py-2 px-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg text-left"
                      >
                        <span className="text-sm text-gray-300">{p.cliente || 'S/N'} — {p.concepto}</span>
                        <span className="text-sm font-bold text-white tabular-nums">{formatPesos(p.monto)}</span>
                      </button>
                    ))}
                  </div>
                )
              )}

              {tab === 'gastos' && (
                todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id).length === 0 ? <p className="text-xs text-gray-500 uppercase tracking-widest">Sin gastos todavía.</p> : (
                  <div className="space-y-2">
                    {todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id).map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setGastoSeleccionado(g)}
                        className={`w-full flex justify-between items-center py-3 px-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg text-left group ${g.estado === 'anulado' ? 'opacity-40' : ''}`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-bold text-gray-200 truncate ${g.estado === 'anulado' ? 'line-through' : ''}`}>{g.descripcion}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria} · {formatHora(g.created_at)}</p>
                        </div>
                        <span className="text-sm font-bold text-red-400 tabular-nums shrink-0 ml-3">{formatPesos(g.monto)}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Acción principal: Registrar Gasto — FAB en mobile, botón en desktop */}
          <button
            onClick={() => setMostrarGasto(true)}
            className="no-print md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-[#FDE047] text-black shadow-2xl flex items-center justify-center"
            title="Registrar gasto"
          >
            <Plus size={24} />
          </button>
          <div className="no-print hidden md:flex gap-4">
            <button onClick={() => setMostrarGasto(true)} className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold uppercase text-xs tracking-widest border border-white/10 transition-all">
              <Plus size={16} /> Registrar Gasto
            </button>
            <button onClick={() => setMostrarCierre(true)} className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all">
              <Lock size={16} /> Cerrar Caja
            </button>
          </div>
          <button onClick={() => setMostrarCierre(true)} className="no-print md:hidden w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-all shadow-xl flex items-center justify-center gap-2">
            <Lock size={16} /> Cerrar Caja de Hoy
          </button>
        </>
      )}

      {/* Estado D: caja cerrada — resumen del día */}
      {cajaSeleccionada && cajaSeleccionada.estado === 'cerrada' && (
        <>
          <div className="no-print flex flex-wrap gap-3">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-xs font-bold uppercase tracking-widest transition-all">
              <Printer size={14} /> Imprimir A4
            </button>
            <button onClick={() => resumen && descargarCajaCSV(resumen)} disabled={!resumen} className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40">
              <Download size={14} /> Exportar CSV
            </button>
            <div className="flex-1" />
            {!reabriendo && puedeReabrir ? (
              <button onClick={() => setReabriendo(true)} className="flex items-center gap-2 px-5 py-3 bg-[#FDE047]/10 hover:bg-[#FDE047]/20 border border-[#FDE047]/20 rounded-xl text-[#FDE047] text-xs font-bold uppercase tracking-widest transition-all">
                Reabrir Caja
              </button>
            ) : null}
          </div>

          {reabriendo && puedeReabrir && (
            <div className="no-print glass-card p-6 rounded-2xl glass-card-inner space-y-4 border border-[#FDE047]/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#FDE047]">Reabrir caja</h3>
                <button onClick={() => { setReabriendo(false); setMotivoReapertura('') }} className="text-gray-500 hover:text-white"><X size={18} /></button>
              </div>
              <textarea
                rows={2} value={motivoReapertura} onChange={(e) => setMotivoReapertura(e.target.value)}
                placeholder="Motivo de la reapertura (obligatorio)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#FDE047]/50 resize-none"
              />
              <button onClick={handleReabrir} disabled={!motivoReapertura.trim()} className="w-full py-3 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all">
                Confirmar reapertura
              </button>
            </div>
          )}

          <div className="no-print">
            {resumenLoading ? <p className="text-xs text-gray-500 uppercase tracking-widest">Cargando resumen...</p> : <ResumenCaja resumen={resumen} />}
          </div>
          <CajaImpresion resumen={resumen} />
        </>
      )}

      <RegistrarGasto isOpen={mostrarGasto} onClose={() => setMostrarGasto(false)} />
      {/* pago/gasto "vivos": el modal queda abierto después de completar un
          comprobante o anular, así que no alcanza con la foto que se guardó
          al abrirlo — hay que buscar siempre la versión actual en pagos/todosGastos. */}
      <DetalleGasto
        isOpen={!!gastoSeleccionado}
        onClose={() => setGastoSeleccionado(null)}
        gasto={gastoSeleccionado ? todosGastos.find((g) => g.id === gastoSeleccionado.id) || gastoSeleccionado : null}
      />
      <DetallePago
        isOpen={!!pagoSeleccionado}
        onClose={() => setPagoSeleccionado(null)}
        pago={pagoSeleccionado ? pagos.find((p) => p.id === pagoSeleccionado.id) || pagoSeleccionado : null}
      />
      <CerrarCajaStepper
        isOpen={mostrarCierre}
        onClose={() => setMostrarCierre(false)}
        efectivoEsperado={efectivoEsperadoPreview}
        onConfirm={handleCerrarCaja}
      />

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

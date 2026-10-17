import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCaja } from '../../hooks/useCaja'
import { useFeatureUrlState } from '../../hooks/useFeatureUrlState'
import { useData } from '../../context/DataProvider'
import { supabase } from '../../lib/supabase'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import DateInput from '../../components/inputs/DateInput'
import BrandSelect from '../../components/ui/BrandSelect'
import LoadingButton from '../../components/ui/LoadingButton'
import { CATEGORIA_GASTO_LABEL, formatHora } from '../../lib/caja'
import { descargarCierreCaja } from '../../lib/export/cajaCsv'
import {
  Plus, Wallet, ChevronLeft, ChevronRight, Banknote,
  ArrowUpRight, ArrowDownRight, Printer, Download, Lock, History, AlertTriangle, X,
} from 'lucide-react'
import { formatPesos, formatFecha } from '../../lib/format'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso, useAuth } from '../../context/AuthProvider'
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

  // Fecha y tab en la URL (Tarea 9, oct 2026) — antes recargar la página a
  // mitad de revisar un día pasado o la pestaña "Facturas" volvía todo a
  // hoy/Movimientos sin avisar; una caja que se consulta a diario se presta
  // a recargar en el medio.
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDate = searchParams.get('fecha') || todayStr()
  const tab = searchParams.get('tab') || 'movimientos'
  const setSelectedDate = (updater) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    const valor = typeof updater === 'function' ? updater(selectedDate) : updater
    valor === todayStr() ? next.delete('fecha') : next.set('fecha', valor)
    return next
  }, { replace: true })
  const setTab = (v) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    v === 'movimientos' ? next.delete('tab') : next.set('tab', v)
    return next
  }, { replace: true })
  // [feat-7] filtro de medio de pago persistido en la URL (apagable en
  // lib/features.ts — si se apaga, vuelve a ser un useState local).
  const [filtroMedio, setFiltroMedio] = useFeatureUrlState('feat-7-caja-filtro-medio-url', 'medio', 'todos')
  const { perfil } = useAuth()
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

  // Caja diaria (oct 2026): empieza siempre en 0, no se pregunta monto
  // inicial — la caja se auto-crea sola en el primer cobro/gasto del día.
  // Este botón solo marca explícitamente abierta_por/abierta_at para un día
  // sin ningún movimiento todavía.
  const handleAbrirCaja = async () => {
    setAbriendo(true)
    try {
      await iniciarCaja()
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

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-prius-muted uppercase animate-pulse">Sincronizando Caja...</span></div>

  return (
    <div className="space-y-8 animate-premium-fade">
      {/* Barra de navegación por fecha + historial */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <button onClick={() => setSelectedDate((d) => shiftDate(d, -1))} className="p-3 bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate transition-all min-w-[44px] min-h-[44px]" title="Día anterior">
          <ChevronLeft size={16} />
        </button>
        <DateInput value={selectedDate} onChange={(v) => v && setSelectedDate(v)} max={todayStr()} className="w-36" />
        <button onClick={() => setSelectedDate((d) => shiftDate(d, 1))} disabled={esHoy} className="p-3 bg-prius-subtle hover:bg-prius-subtle disabled:opacity-30 disabled:cursor-not-allowed border border-hairline rounded-xl text-prius-slate transition-all min-w-[44px] min-h-[44px]" title="Día siguiente">
          <ChevronRight size={16} />
        </button>
        {!esHoy && (
          <button onClick={() => setSelectedDate(todayStr())} className="px-4 py-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-xl text-gold text-xs font-bold uppercase tracking-widest transition-all">
            Volver a Hoy
          </button>
        )}
        {cajaSeleccionada && (
          <span className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase border ${cajaSeleccionada.estado === 'cerrada' ? 'bg-red-500/10 text-prius-error border-red-500/20' : 'bg-green-500/10 text-prius-success border-green-500/20'}`}>
            {cajaSeleccionada.estado === 'cerrada' ? 'Caja Cerrada' : 'Caja Abierta'}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setMostrarHistorial((v) => !v)}
          className="flex items-center gap-2 px-4 py-3 bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate text-xs font-bold uppercase tracking-widest transition-all min-h-[44px]"
        >
          <History size={14} /> Historial
        </button>
      </div>

      {mostrarHistorial && (
        <div className="no-print card-light p-6 rounded-2xl card-light-inner space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-prius-slate mb-3">Historial de cajas</h3>
          {historialCajas.length === 0 ? (
            <p className="text-xs text-prius-muted uppercase tracking-widest">Sin cajas registradas todavía.</p>
          ) : historialCajas.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedDate(c.fecha); setMostrarHistorial(false) }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-prius-subtle transition-all text-left"
            >
              <span className="text-sm text-prius-slate">{formatFecha(c.fecha)}</span>
              <span className="flex items-center gap-4 text-xs">
                <span className="font-bold text-black tabular-nums">{formatPesos(c.total_neto)}</span>
                {c.diferencia != null && Number(c.diferencia) !== 0 && (
                  <span className="text-gold tabular-nums">dif. {formatPesos(c.diferencia)}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Estado A: sin caja */}
      {!cajaSeleccionada && (
        esHoy ? (
          <div className="no-print card-light p-20 text-center rounded-3xl card-light-inner space-y-6">
            <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto border border-gold/20">
              <Wallet className="w-10 h-10 text-gold" />
            </div>
            <h2 className="text-xl font-bold text-black uppercase tracking-wider">Caja no iniciada</h2>
            <p className="text-prius-slate text-sm max-w-md mx-auto">Abrí la caja del día para empezar a registrar cobros y gastos. Siempre arranca en $0.</p>
            <div className="max-w-xs mx-auto">
              <LoadingButton
                onClick={handleAbrirCaja}
                loading={abriendo}
                loadingText="Abriendo..."
                className="w-full bg-gold hover:bg-gold-hover text-black px-8 py-4 rounded-xl font-bold uppercase text-xs tracking-widest shadow-2xl"
              >
                Abrir Caja de Hoy
              </LoadingButton>
            </div>
          </div>
        ) : (
          <div className="no-print card-light p-20 text-center rounded-3xl card-light-inner">
            <p className="text-prius-slate text-sm uppercase tracking-widest font-bold">Sin movimientos registrados este día.</p>
          </div>
        )
      )}

      {/* Estado B: caja abierta (en vivo) */}
      {cajaSeleccionada && cajaSeleccionada.estado === 'abierta' && (
        <>
          <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-light p-5 rounded-2xl card-light-inner">
              <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Ingresos</p>
              <p className="text-xl font-bold text-prius-success tabular-nums">{formatPesos(cajaSeleccionada.total_cobros)}</p>
            </div>
            <div className="card-light p-5 rounded-2xl card-light-inner">
              <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Egresos</p>
              <p className="text-xl font-bold text-prius-error tabular-nums">{formatPesos(cajaSeleccionada.total_gastos)}</p>
            </div>
            <div className="card-light p-5 rounded-2xl card-light-inner border border-gold/20">
              <p className="text-[10px] font-bold text-prius-slate uppercase tracking-widest mb-2">Neto</p>
              <p className="text-xl font-bold text-gold tabular-nums">{formatPesos(cajaSeleccionada.total_neto)}</p>
            </div>
            <div className="card-light p-5 rounded-2xl card-light-inner flex items-center gap-3">
              <Banknote className="text-prius-success shrink-0" size={20} />
              <div>
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Efectivo esperado</p>
                <p className="text-lg font-bold text-black tabular-nums">{formatPesos(efectivoEsperadoPreview)}</p>
              </div>
            </div>
          </div>

          {(resumen?.por_medio?.length > 0) && (
            <div className="no-print flex flex-wrap gap-3">
              {resumen.por_medio.map((m) => (
                <div key={m.medio} className="px-4 py-2 bg-prius-subtle border border-hairline rounded-xl text-xs flex items-center gap-2">
                  <span className="text-prius-slate">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                  <span className="font-bold text-black tabular-nums">{formatPesos(m.neto)}</span>
                </div>
              ))}
            </div>
          )}

          {resumen?.sin_comprobante?.length > 0 && (
            <div className="no-print flex items-start gap-3 p-4 bg-gold/5 border border-gold/20 rounded-xl">
              <AlertTriangle className="text-gold shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-prius-slate">
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
                    tab === t.value ? 'bg-gold text-black' : 'bg-prius-subtle text-prius-slate hover:text-black border border-hairline'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="flex-1" />
              {tab === 'movimientos' && (
                <div className="w-48">
                  <BrandSelect value={filtroMedio} onChange={setFiltroMedio} options={FILTROS_MEDIO} className="py-2.5" />
                </div>
              )}
            </div>

            <div className="card-light p-6 sm:p-8 rounded-3xl card-light-inner">
              {tab === 'movimientos' && (
                movimientosFiltrados.length === 0 ? (
                  <p className="text-xs text-prius-muted uppercase tracking-widest">Sin movimientos con este filtro.</p>
                ) : (
                  <div className="space-y-2">
                    {movimientosFiltrados.map((m) => (
                      <button
                        key={`${m.tipo_movimiento}-${m.movimiento_id}`}
                        onClick={() => abrirDetalleMovimiento(m)}
                        className={`w-full flex justify-between items-center py-3 px-2 border-b border-hairline last:border-0 hover:bg-prius-subtle rounded-lg transition-all text-left ${m.estado === 'anulado' ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {m.tipo_movimiento === 'ingreso' ? <ArrowUpRight size={16} className="text-prius-success shrink-0" /> : <ArrowDownRight size={16} className="text-prius-error shrink-0" />}
                          <div className="min-w-0">
                            <p className={`text-sm font-bold text-prius-slate truncate ${m.estado === 'anulado' ? 'line-through' : ''}`}>{m.concepto}</p>
                            <p className="text-[10px] text-prius-muted uppercase tracking-widest">{m.cliente_proveedor} · {MEDIO_PAGO_LABEL[m.medio_pago] || m.medio_pago} · {formatHora(m.fecha_hora)}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${m.monto < 0 ? 'text-prius-error' : 'text-prius-success'}`}>{formatPesos(m.monto)}</span>
                      </button>
                    ))}
                  </div>
                )
              )}

              {tab === 'facturas' && (
                (resumen?.facturas || []).length === 0 ? <p className="text-xs text-prius-muted uppercase tracking-widest">Sin facturas todavía.</p> : (
                  <div className="space-y-2">
                    {resumen.facturas.map((f) => (
                      <div key={f.etiqueta} className="flex justify-between py-2 border-b border-hairline last:border-0">
                        <span className="text-sm text-prius-slate">{f.etiqueta}</span>
                        <span className="text-sm font-bold text-black tabular-nums">{formatPesos(f.monto_total)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'recibos' && (
                (resumen?.recibos || []).length === 0 ? <p className="text-xs text-prius-muted uppercase tracking-widest">Sin recibos todavía.</p> : (
                  <div className="space-y-2">
                    {resumen.recibos.map((r) => (
                      <div key={r.etiqueta} className="flex justify-between py-2 border-b border-hairline last:border-0">
                        <span className="text-sm text-prius-slate">{r.etiqueta}</span>
                        <span className="text-sm font-bold text-black tabular-nums">{formatPesos(r.monto_total)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'sin_comprobante' && (
                (resumen?.sin_comprobante || []).length === 0 ? <p className="text-xs text-prius-muted uppercase tracking-widest">Todos los pagos tienen comprobante.</p> : (
                  <div className="space-y-2">
                    {resumen.sin_comprobante.map((p) => (
                      <button
                        key={p.pago_id}
                        onClick={() => { const pago = pagos.find((x) => x.id === p.pago_id); if (pago) setPagoSeleccionado(pago) }}
                        className="w-full flex justify-between py-2 px-2 border-b border-hairline last:border-0 hover:bg-prius-subtle rounded-lg text-left"
                      >
                        <span className="text-sm text-prius-slate">{p.cliente || 'S/N'} — {p.concepto}</span>
                        <span className="text-sm font-bold text-black tabular-nums">{formatPesos(p.monto)}</span>
                      </button>
                    ))}
                  </div>
                )
              )}

              {tab === 'gastos' && (
                todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id).length === 0 ? <p className="text-xs text-prius-muted uppercase tracking-widest">Sin gastos todavía.</p> : (
                  <div className="space-y-2">
                    {todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id).map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setGastoSeleccionado(g)}
                        className={`w-full flex justify-between items-center py-3 px-2 border-b border-hairline last:border-0 hover:bg-prius-subtle rounded-lg text-left group ${g.estado === 'anulado' ? 'opacity-40' : ''}`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-bold text-prius-slate truncate ${g.estado === 'anulado' ? 'line-through' : ''}`}>{g.descripcion}</p>
                          <p className="text-[10px] text-prius-muted uppercase tracking-widest">{CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria} · {formatHora(g.created_at)}</p>
                        </div>
                        <span className="text-sm font-bold text-prius-error tabular-nums shrink-0 ml-3">{formatPesos(g.monto)}</span>
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
            className="no-print md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gold text-black shadow-2xl flex items-center justify-center"
            title="Registrar gasto"
          >
            <Plus size={24} />
          </button>
          <div className="no-print hidden md:flex gap-4">
            <button onClick={() => setMostrarGasto(true)} className="flex items-center gap-2 px-6 py-3 bg-prius-subtle hover:bg-prius-subtle text-black rounded-xl font-bold uppercase text-xs tracking-widest border border-hairline transition-all">
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
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate text-xs font-bold uppercase tracking-widest transition-all">
              <Printer size={14} /> Imprimir A4
            </button>
            <button onClick={() => resumen && descargarCierreCaja(resumen, { exportadoPorNombre: perfil?.nombre || perfil?.usuario || 'Usuario' })} disabled={!resumen} className="flex items-center gap-2 px-5 py-3 bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40">
              <Download size={14} /> Exportar CSV
            </button>
            <div className="flex-1" />
            {!reabriendo && puedeReabrir ? (
              <button onClick={() => setReabriendo(true)} className="flex items-center gap-2 px-5 py-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-xl text-gold text-xs font-bold uppercase tracking-widest transition-all">
                Reabrir Caja
              </button>
            ) : null}
          </div>

          {reabriendo && puedeReabrir && (
            <div className="no-print card-light p-6 rounded-2xl card-light-inner space-y-4 border border-gold/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Reabrir caja</h3>
                <button onClick={() => { setReabriendo(false); setMotivoReapertura('') }} className="text-prius-muted hover:text-black"><X size={18} /></button>
              </div>
              <textarea
                rows={2} value={motivoReapertura} onChange={(e) => setMotivoReapertura(e.target.value)}
                placeholder="Motivo de la reapertura (obligatorio)"
                className="w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-base md:text-sm outline-none focus:border-gold/50 resize-none"
              />
              <button onClick={handleReabrir} disabled={!motivoReapertura.trim()} className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all">
                Confirmar reapertura
              </button>
            </div>
          )}

          <div className="no-print">
            {resumenLoading ? <p className="text-xs text-prius-muted uppercase tracking-widest">Cargando resumen...</p> : <ResumenCaja resumen={resumen} />}
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

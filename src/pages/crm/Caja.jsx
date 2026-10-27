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
  Plus, Wallet, ChevronLeft, ChevronRight, Banknote, Landmark, QrCode, CreditCard,
  ArrowUpRight, ArrowDownRight, Printer, Download, Lock, History, AlertTriangle, X,
} from 'lucide-react'
import { formatPesos, formatFecha } from '../../lib/format'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso, useAuth } from '../../context/AuthProvider'
import RegistrarGasto from '../../components/crm/RegistrarGasto'
import DetalleGasto from '../../components/crm/DetalleGasto'
import DetallePago from '../../components/crm/DetallePago'
import ConfirmarSuperadminModal from '../../components/crm/ConfirmarSuperadminModal'
import ResumenCaja from '../../components/crm/ResumenCaja'
import CajaImpresion from '../../components/crm/CajaImpresion'
import CerrarCajaStepper from '../../components/crm/CerrarCajaStepper'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'
import MontoStat from '../../components/ui/MontoStat'

const FILTROS_MEDIO = [
  { value: 'todos', label: 'Todos los medios' },
  ...Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({ value, label })),
]

const MEDIO_ICONO = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercado_pago: QrCode,
  tarjeta_debito: CreditCard,
  tarjeta_credito: CreditCard,
}

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
  const readyCaja = useInitialLoad(loading)
  const puedeReabrir = usePermiso('reabrir_caja')
  const { pagos } = useData()
  const { alert, toast } = useDialog()

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

  // Ítem 1 (25/10/2026): "Efectivo esperado" pasa a "Total esperado" — la
  // suma de Esperado de TODOS los medios con movimiento (antes solo
  // efectivo), ver arqueo.total en resumen_caja(). El detalle por medio ya
  // vive en "Desglose por Medio de Pago" (desktop aside / chips mobile)
  // debajo, así que no se duplica acá — decisión documentada en el reporte
  // de la tarea.
  const totalEsperadoPreview = resumen?.arqueo?.total?.esperado ?? 0

  // Caja diaria (oct 2026): empieza siempre en 0, no se pregunta monto
  // inicial — la caja se auto-crea sola en el primer cobro/gasto del día.
  // Este botón solo marca explícitamente abierta_por/abierta_at para un día
  // sin ningún movimiento todavía.
  const handleAbrirCaja = async () => {
    setAbriendo(true)
    try {
      await iniciarCaja()
      toast('Caja abierta con éxito', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo abrir la caja.', { tone: 'error' })
    } finally {
      setAbriendo(false)
    }
  }

  const handleCerrarCaja = async ({ efectivoContado, contadoPorMedio, observaciones, datosZ }) => {
    try {
      await cerrarCaja(cajaSeleccionada.id, efectivoContado, datosZ, observaciones, contadoPorMedio)
      toast('Caja cerrada con éxito', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo cerrar la caja.', { tone: 'error' })
      throw err
    }
  }

  const [confirmarReabrir, setConfirmarReabrir] = useState(false)
  const handleReabrir = () => {
    if (!motivoReapertura.trim()) return
    setConfirmarReabrir(true)
  }
  const handleConfirmReabrir = async (password) => {
    await reabrirCaja(cajaSeleccionada.id, motivoReapertura.trim(), password)
    setReabriendo(false)
    setMotivoReapertura('')
    setConfirmarReabrir(false)
    toast('Caja reabierta con éxito', { tone: 'success' })
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

  if (!readyCaja) {
    return (
      <div className="space-y-4 font-ui">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-premium-fade">
      {/* Barra de navegación por fecha + historial. Pulido mobile iPhone (oct
          2026): en mobile la navegación de fecha pasa a ser su propia fila
          simétrica de ancho completo (flecha | fecha | flecha, las dos
          flechas del mismo tamaño y la fecha ocupando el centro) — antes
          quedaba apretada entre "Volver a Hoy" y el badge de estado, que
          wrappeaban de forma impredecible. Debajo, estado + Historial en una
          fila de dos columnas iguales. Desktop (sm+) sigue siendo la fila
          única de siempre. */}
      <div className="no-print space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex items-center gap-3 sm:contents">
          <button onClick={() => setSelectedDate((d) => shiftDate(d, -1))} className="shrink-0 p-3 bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate transition-all min-w-[44px] min-h-[44px]" title="Día anterior">
            <ChevronLeft size={16} />
          </button>
          {/* w-36 (144px) no entraba la fecha completa en mobile (texto 16px ahí
              vs 14px en desktop) — encontrado auditando el fix de tabular-nums
              del Plano, oct 2026. flex-1 en mobile para que la fecha ocupe el
              centro de la fila simétrica; ancho fijo en desktop (sin cambios). */}
          <DateInput value={selectedDate} onChange={(v) => v && setSelectedDate(v)} max={todayStr()} className="flex-1 min-w-0 sm:flex-none sm:w-[164px]" />
          <button onClick={() => setSelectedDate((d) => shiftDate(d, 1))} disabled={esHoy} className="shrink-0 p-3 bg-prius-subtle hover:bg-prius-subtle disabled:opacity-30 disabled:cursor-not-allowed border border-hairline rounded-xl text-prius-slate transition-all min-w-[44px] min-h-[44px]" title="Día siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
        {!esHoy && (
          <button onClick={() => setSelectedDate(todayStr())} className="w-full sm:w-auto px-4 py-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-xl text-gold text-xs font-bold uppercase tracking-widest transition-all">
            Volver a Hoy
          </button>
        )}
        {cajaSeleccionada && (
          <span className={`hidden sm:inline-block px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase border ${cajaSeleccionada.estado === 'cerrada' ? 'bg-red-500/10 text-prius-error border-red-500/20' : 'bg-green-500/10 text-prius-success border-green-500/20'}`}>
            {cajaSeleccionada.estado === 'cerrada' ? 'Caja Cerrada' : 'Caja Abierta'}
          </span>
        )}
        <div className="hidden sm:block sm:flex-1" />
        <button
          onClick={() => setMostrarHistorial((v) => !v)}
          className="hidden sm:flex items-center gap-2 px-4 py-3 bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate text-xs font-bold uppercase tracking-widest transition-all min-h-[44px]"
        >
          <History size={14} /> Historial
        </button>
      </div>

      {/* Estado + Historial: fila de dos columnas iguales, solo mobile (sm:
          ya los muestra arriba en la fila de siempre). */}
      {cajaSeleccionada && (
        <div className="no-print sm:hidden grid grid-cols-2 gap-3">
          <span className={`flex items-center justify-center px-4 py-3 min-h-[44px] rounded-xl text-[10px] font-bold tracking-widest uppercase border ${cajaSeleccionada.estado === 'cerrada' ? 'bg-red-500/10 text-prius-error border-red-500/20' : 'bg-green-500/10 text-prius-success border-green-500/20'}`}>
            {cajaSeleccionada.estado === 'cerrada' ? 'Caja Cerrada' : 'Caja Abierta'}
          </span>
          <button
            onClick={() => setMostrarHistorial((v) => !v)}
            className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-prius-subtle hover:bg-prius-subtle border border-hairline rounded-xl text-prius-slate text-xs font-bold uppercase tracking-widest transition-all"
          >
            <History size={14} /> Historial
          </button>
        </div>
      )}

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

      {/* Estado B: caja abierta (en vivo) — mock 05-caja-desktop-abierta /
          05-caja-mobile-abierta: 4 KPI cards, tabla de movimientos (desktop)
          o feed de tarjetas (mobile/tablet) a la izquierda, desglose por
          medio con tiles + acciones a la derecha en >=1024px. Ningún botón
          "Cobrar" acá — el único alta manual de esta pantalla es Registrar
          Gasto (ver CLAUDE.md). */}
      {cajaSeleccionada && cajaSeleccionada.estado === 'abierta' && (
        <div className="no-print space-y-6">
          {/* 4 KPI cards — grilla 2x2 en mobile (pulido mobile iPhone, oct
              2026): las 4 usan el mismo componente de monto (MontoStat,
              clamp + nowrap) en vez de 1 con text-metric-xl y 3 con
              text-2xl fijo — eso partía los montos largos ($ 239.947.560)
              en dos renglones en 375px. Título siempre en una línea
              (truncate), ícono 32px arriba a la derecha igual en las
              cuatro, el pill de la primera con overflow-hidden/truncate
              para que nunca se salga de la card. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-hairline rounded-2xl p-4 sm:p-5 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest truncate">Neto en caja</p>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-prius-surface flex items-center justify-center text-prius-slate"><Wallet size={16} /></div>
              </div>
              <MontoStat value={cajaSeleccionada.total_neto} className="text-black mb-2" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-prius-success text-[10px] font-medium max-w-full overflow-hidden mt-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-prius-success shrink-0" />
                <span className="truncate">Arqueado en tiempo real</span>
              </span>
            </div>
            <div className="bg-white border border-hairline rounded-2xl p-4 sm:p-5 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest truncate">Ingresos</p>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-prius-success"><ArrowDownRight size={16} /></div>
              </div>
              <MontoStat value={cajaSeleccionada.total_cobros} size="md" className="text-prius-success mb-2" />
              <p className="text-[10px] text-prius-muted mt-auto truncate">{movimientos.filter((m) => m.tipo_movimiento === 'ingreso' && m.estado !== 'anulado').length} cobro{movimientos.filter((m) => m.tipo_movimiento === 'ingreso').length === 1 ? '' : 's'} acreditado{movimientos.filter((m) => m.tipo_movimiento === 'ingreso').length === 1 ? '' : 's'}</p>
            </div>
            <div className="bg-white border border-hairline rounded-2xl p-4 sm:p-5 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest truncate">Egresos</p>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-prius-surface flex items-center justify-center text-prius-slate"><ArrowUpRight size={16} /></div>
              </div>
              <MontoStat value={cajaSeleccionada.total_gastos} size="md" className="text-black mb-2" />
              <p className="text-[10px] text-prius-muted mt-auto truncate">{todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id && g.estado !== 'anulado').length > 0 ? `${todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id).length} gasto(s) cargado(s)` : 'Sin retiros cargados'}</p>
            </div>
            <div className="bg-white border border-hairline rounded-2xl p-4 sm:p-5 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest truncate">Total esperado</p>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-prius-surface flex items-center justify-center text-prius-slate"><Banknote size={16} /></div>
              </div>
              <MontoStat value={totalEsperadoPreview} size="md" className="text-black mb-2" />
              <p className="text-[10px] text-prius-muted mt-auto truncate">Todos los medios — ver desglose</p>
            </div>
          </div>

          <div className="lg:flex lg:gap-6 lg:items-start">
            {/* Columna izquierda: tabs + movimientos */}
            <div className="lg:flex-1 lg:min-w-0 space-y-4">
              <div className="bg-white border border-hairline rounded-2xl p-6 sm:p-7 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {TABS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTab(t.value)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] ${
                          tab === t.value ? 'bg-gold text-black' : 'bg-prius-surface text-prius-slate hover:bg-hairline'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {tab === 'movimientos' && (
                    <div className="w-full sm:w-48 shrink-0">
                      <BrandSelect value={filtroMedio} onChange={setFiltroMedio} options={FILTROS_MEDIO} className="py-2" />
                    </div>
                  )}
                </div>

                {tab === 'movimientos' && (
                  movimientosFiltrados.length === 0 ? (
                    <p className="text-xs text-prius-muted uppercase tracking-widest">Sin movimientos con este filtro.</p>
                  ) : (
                    <>
                      {/* Desktop: tabla real (mock) */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] font-bold text-prius-muted uppercase tracking-widest border-b border-hairline">
                              <th className="pb-3 px-2">Hora</th>
                              <th className="pb-3 px-2">Tipo</th>
                              <th className="pb-3 px-2">Cliente / Unidad</th>
                              <th className="pb-3 px-2">Concepto</th>
                              <th className="pb-3 px-2">Comprobante</th>
                              <th className="pb-3 px-2">Medio</th>
                              <th className="pb-3 px-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline text-xs">
                            {movimientosFiltrados.map((m) => (
                              <tr
                                key={`${m.tipo_movimiento}-${m.movimiento_id}`}
                                onClick={() => abrirDetalleMovimiento(m)}
                                className={`hover:bg-prius-surface cursor-pointer transition-colors ${m.estado === 'anulado' ? 'opacity-40' : ''}`}
                              >
                                <td className="py-3 px-2 text-prius-slate font-medium whitespace-nowrap">{formatHora(m.fecha_hora)}</td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${m.tipo_movimiento === 'ingreso' ? 'bg-green-50 text-prius-success' : 'bg-red-50 text-prius-error'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${m.tipo_movimiento === 'ingreso' ? 'bg-prius-success' : 'bg-prius-error'}`} />
                                    {m.tipo_movimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
                                  </span>
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <span className={`font-bold text-black ${m.estado === 'anulado' ? 'line-through' : ''}`}>{m.cliente_proveedor || 'S/N'}</span>
                                  {m.unidad && <span className="text-prius-muted"> • {m.unidad}</span>}
                                </td>
                                <td className="py-3 px-2 text-prius-slate">{m.concepto}</td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  {m.comprobante ? (
                                    <span className="px-2 py-1 rounded-lg bg-prius-surface text-prius-slate font-mono text-[10px] font-semibold">{m.comprobante}</span>
                                  ) : (
                                    <span className="text-prius-muted text-[10px]">Sin comprobante</span>
                                  )}
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap text-prius-slate">{MEDIO_PAGO_LABEL[m.medio_pago] || m.medio_pago}</td>
                                <td className={`py-3 px-2 text-right font-bold tabular-nums whitespace-nowrap ${m.monto < 0 ? 'text-prius-error' : 'text-black'}`}>{formatPesos(m.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Tablet/mobile: feed de tarjetas (mock mobile-abierta). Pulido
                          mobile iPhone (oct 2026): rediseñada en dos renglones para que
                          nada se salga de la card — antes "12:21" quedaba cortado al
                          final de un único renglón con cliente+unidad+medio+hora+ícono.
                          Renglón 1: concepto truncado + monto. Renglón 2 (chico,
                          truncado): cliente · unidad · medio · hora. Chip de comprobante
                          debajo, en su propia línea. */}
                      <div className="lg:hidden space-y-2">
                        {movimientosFiltrados.map((m) => (
                          <button
                            key={`${m.tipo_movimiento}-${m.movimiento_id}`}
                            onClick={() => abrirDetalleMovimiento(m)}
                            className={`w-full flex flex-col gap-1 p-3 bg-prius-surface rounded-xl text-left transition-all ${m.estado === 'anulado' ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 w-6 h-6 rounded-md bg-white flex items-center justify-center ${m.tipo_movimiento === 'ingreso' ? 'text-prius-success' : 'text-prius-error'}`}>
                                  {m.tipo_movimiento === 'ingreso' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                </span>
                                <p className={`text-sm font-bold text-black truncate min-w-0 ${m.estado === 'anulado' ? 'line-through' : ''}`}>{m.concepto}</p>
                              </div>
                              <span className={`text-sm font-bold tabular-nums whitespace-nowrap shrink-0 ${m.monto < 0 ? 'text-prius-error' : 'text-prius-success'}`}>{formatPesos(m.monto)}</span>
                            </div>
                            <p className="text-[10px] text-prius-muted uppercase tracking-wider truncate pl-8">
                              {m.cliente_proveedor}{m.unidad ? ` · ${m.unidad}` : ''} · {MEDIO_PAGO_LABEL[m.medio_pago] || m.medio_pago} · {formatHora(m.fecha_hora)}
                            </p>
                            {m.comprobante && (
                              <span className="inline-block self-start ml-8 px-2 py-0.5 rounded bg-white text-[10px] font-mono font-semibold text-prius-slate">{m.comprobante}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
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
                          className="w-full flex justify-between py-2 px-2 border-b border-hairline last:border-0 hover:bg-prius-surface rounded-lg text-left"
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
                          className={`w-full flex justify-between items-center py-3 px-2 border-b border-hairline last:border-0 hover:bg-prius-surface rounded-lg text-left ${g.estado === 'anulado' ? 'opacity-40' : ''}`}
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

              {/* Mobile/tablet: desglose por medio + alerta + acciones, abajo del todo */}
              <div className="lg:hidden space-y-4">
                {resumen?.por_medio?.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {resumen.por_medio.map((m) => (
                      <div key={m.medio} className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-prius-surface text-xs whitespace-nowrap shrink-0">
                        <span className="text-prius-slate">{MEDIO_PAGO_LABEL[m.medio] || m.medio}:</span>
                        <span className="font-bold text-black tabular-nums">{formatPesos(m.neto)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {resumen?.sin_comprobante?.length > 0 && (
                  <div className="flex items-start gap-3 p-4 bg-gold/5 border border-gold/20 rounded-xl">
                    <AlertTriangle className="text-gold shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-prius-slate">
                      Hay {resumen.sin_comprobante.length} pago{resumen.sin_comprobante.length > 1 ? 's' : ''} sin comprobante cargado todavía.
                    </p>
                  </div>
                )}
                <div className="hidden md:flex gap-4">
                  <button onClick={() => setMostrarGasto(true)} className="flex items-center gap-2 px-6 py-3 bg-prius-surface hover:bg-hairline text-black rounded-xl font-bold uppercase text-xs tracking-widest border border-hairline transition-all">
                    <Plus size={16} /> Registrar Gasto
                  </button>
                  <button onClick={() => setMostrarCierre(true)} className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all">
                    <Lock size={16} /> Cerrar Caja
                  </button>
                </div>
              </div>

              {/* Mobile (<768px): acciones en botones visibles dentro de la
                  sección, apiladas. Antes "Registrar Gasto" era un FAB
                  flotante fijo (bottom-24 right-4, con sombra) — se saca del
                  todo (pulido mobile iPhone, oct 2026): el único botón
                  flotante de alta que queda en la app es el "+" de la
                  bottom nav (Nueva reserva). Esta acción pasa a un botón de
                  ancho completo, mismo estilo que su par de desktop. */}
              <div className="md:hidden space-y-3">
                <button onClick={() => setMostrarGasto(true)} className="w-full py-4 bg-prius-surface hover:bg-hairline border border-hairline text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px]">
                  <Plus size={16} /> Registrar Gasto
                </button>
                <button onClick={() => setMostrarCierre(true)} className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px]">
                  <Lock size={16} /> Cerrar Caja de Hoy
                </button>
              </div>
            </div>

            {/* Columna derecha — solo >=1024px: desglose por medio con tiles + acciones (mock). */}
            <aside className="hidden lg:flex lg:w-80 lg:shrink-0 flex-col gap-4 sticky top-4 self-start">
              {resumen?.por_medio?.length > 0 && (
                <div className="bg-white border border-hairline rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-black">Desglose por Medio de Pago</h3>
                  <div className="space-y-3">
                    {resumen.por_medio.map((m) => {
                      const IconoMedio = MEDIO_ICONO[m.medio] || Banknote
                      return (
                        <div key={m.medio} className="bg-prius-surface rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-prius-slate">
                              <IconoMedio size={18} />
                            </div>
                            <span className="text-sm font-semibold text-black">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                          </div>
                          <span className="text-sm font-bold text-black tabular-nums">{formatPesos(m.neto)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {resumen?.sin_comprobante?.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-gold/5 border border-gold/20 rounded-xl">
                  <AlertTriangle className="text-gold shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-prius-slate">
                    Hay {resumen.sin_comprobante.length} pago{resumen.sin_comprobante.length > 1 ? 's' : ''} sin comprobante cargado todavía.
                  </p>
                </div>
              )}

              <button onClick={() => setMostrarGasto(true)} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-hairline hover:bg-prius-surface text-black rounded-xl font-medium text-sm transition-all">
                <Plus size={18} className="text-prius-slate" /> Registrar gasto
              </button>
              <button onClick={() => setMostrarCierre(true)} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-black hover:bg-gray-800 text-white rounded-xl font-medium text-sm transition-all">
                <Lock size={18} /> Cerrar caja diaria
              </button>
            </aside>
          </div>
        </div>
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

          <ConfirmarSuperadminModal
            isOpen={confirmarReabrir}
            onClose={() => setConfirmarReabrir(false)}
            onConfirm={handleConfirmReabrir}
            titulo="Reabrir caja"
            afectaLinea={`Caja de ${formatFecha(selectedDate)} — ${motivoReapertura.trim()}`}
            confirmLabel="Reabrir caja"
          />

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
        porMedio={resumen?.por_medio || []}
        onConfirm={handleCerrarCaja}
      />

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  )
}

import ToolbarSticky from '../../components/brand/ToolbarSticky'
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCaja } from '../../hooks/useCaja'
import { useFeatureUrlState } from '../../hooks/useFeatureUrlState'
import { useData } from '../../context/DataProvider'
import { supabase } from '../../lib/supabase'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_LABEL_CORTO } from '../../lib/pagos'
import DateInput from '../../components/inputs/DateInput'
import BrandSelect from '../../components/ui/BrandSelect'
import LoadingButton from '../../components/ui/LoadingButton'
import { CATEGORIA_GASTO_LABEL, formatHora } from '../../lib/caja'
import BadgeFactura from '../../components/crm/BadgeFactura'
import { descargarCierreCaja } from '../../lib/export/cajaCsv'
import { descargarCierrePdf } from '../../lib/reportePdf'
import {
  Plus, Wallet, ChevronLeft, ChevronRight, Banknote,
  ArrowUpRight, ArrowDownRight, Printer, Download, FileDown, Lock, AlertTriangle, X,
} from 'lucide-react'
import { formatMonto, formatFecha } from '../../lib/format'
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
import MonedaSwitch, { useMonedaVista } from '../../components/ui/MonedaSwitch'
import { emojiEnTexto } from '../../lib/unidadIcono'
import FilaMedioPago from '../../components/crm/FilaMedioPago'
import { hoyAR, sumarDias } from '../../lib/fechas'

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

// Todos los botones de la barra, misma altura y en neutro: el único color de
// la barra es el chip de estado (nov 2026).
const CLASE_ACCION = 'text-label shrink-0 flex items-center gap-2 px-4 xl:px-3 2xl:px-4 h-11 md:h-10 min-h-0 bg-surface hover:bg-surface anim-colors border border-line rounded-full text-ink-2 hover:text-ink transition-all'

// Difuminado de los bordes cuando la fila de acciones scrollea en horizontal —
// misma técnica que SegmentedScroll (mask-image), sin componente nuevo.
function useMaskScrollX(ref) {
  const [bordes, setBordes] = useState({ izq: false, der: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => {
      const izq = el.scrollLeft > 1
      const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setBordes((p) => (p.izq === izq && p.der === der ? p : { izq, der }))
    }
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', medir); ro.disconnect() }
  }, [ref])
  if (!bordes.izq && !bordes.der) return undefined
  return `linear-gradient(to right, ${bordes.izq ? 'transparent 0, black 28px' : 'black 0'}, ${bordes.der ? 'black calc(100% - 28px), transparent 100%' : 'black 100%'})`
}

const todayStr = hoyAR

const shiftDate = sumarDias

export default function Caja() {
  const { cajaHoy, historialCajas, todosGastos, loading, iniciarCaja, cerrarCaja, reabrirCaja } = useCaja()
  const readyCaja = useInitialLoad(loading)
  const puedeReabrir = usePermiso('reabrir_caja')
  // Switch Pesos/Dólares (31/10/2026): solo presentación — los montos que
  // llegan de la base ya están en pesos; `fmtM` los convierte para mostrar.
  const mv = useMonedaVista()
  const fmtM = mv.fmt
  const { pagos, refetchAll, categoriasGasto } = useData()
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
  const [mostrarGasto, setMostrarGasto] = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(false)
  // Respaldo del cierre automático de las 00:00 ART: al abrir Caja se vuelve a correr (idempotente).
  // Si todavía no está la función en la base, el error se ignora.
  useEffect(() => {
    supabase.rpc('fn_cierre_automatico_caja').then(({ data }) => { if (data > 0) refetchAll?.() }, () => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null)
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null)
  const [reabriendo, setReabriendo] = useState(false)
  const [motivoReapertura, setMotivoReapertura] = useState('')

  const accionesRef = useRef(null)
  const maskAcciones = useMaskScrollX(accionesRef)

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
  // Chip de estado: el único color de la barra (nov 2026). Con el arqueo
  // pendiente el chip dice "Falta el arqueo" y no la frase larga de antes
  // ("Cerrada automáticamente · falta el arqueo"): en una sola fila esa frase
  // se comía el lugar de las acciones y terminaba cortada. El detalle completo
  // queda en el title, y justo al lado está el botón "Hacer arqueo y Z".
  const estadoCajaTexto = cajaSeleccionada?.arqueo_pendiente
    ? 'Falta el arqueo'
    : cajaSeleccionada?.estado === 'cerrada' ? 'Caja Cerrada' : 'Caja Abierta'
  const estadoCajaTitle = cajaSeleccionada?.arqueo_pendiente
    ? 'La caja se cerró automáticamente a las 00:00: falta el arqueo y la Z'
    : estadoCajaTexto
  // ?cerrar=1 (desde los avisos de cierre): abre el cierre/arqueo de la caja elegida si corresponde.
  useEffect(() => {
    if (searchParams.get('cerrar') !== '1' || !cajaSeleccionada) return
    if (cajaSeleccionada.estado === 'abierta' || cajaSeleccionada.arqueo_pendiente) setMostrarCierre(true)
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('cerrar'); return n }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaSeleccionada?.id])

  // Fuente única de verdad: pantalla, impresión A4 y CSV parten siempre del
  // mismo resumen_caja(caja_id), EN VIVO, esté la caja abierta o cerrada
  // (nov 2026). Antes una caja cerrada se leía de `resumen_snapshot`, la
  // copia congelada al cerrar, así que una corrección hecha después desde la
  // ficha del cliente (ej. un RB que en realidad era FB) nunca se veía acá.
  // El snapshot sigue guardándose, pero solo como registro de auditoría de
  // cómo estaba la caja al momento del cierre: no se muestra, no se imprime
  // y no se exporta.
  const cargarResumen = useCallback(async (caja) => {
    if (!caja) { setResumen(null); setMovimientos([]); return }
    setResumenLoading(true)
    const { data } = await supabase.rpc('resumen_caja', { p_caja_id: caja.id })
    setResumen(data || null)
    setResumenLoading(false)
    const { data: mov } = await supabase
      .from('v_caja_movimientos')
      .select('*')
      .eq('caja_id', caja.id)
      .order('fecha_hora', { ascending: false })
    setMovimientos(mov || [])
  }, [])

  // `pagos` en las dependencias: el DataProvider lo refetchea con cada
  // cambio en `pagos` O en `comprobantes` (Realtime), así que corregir el
  // tipo/número/monto de un comprobante desde la ficha del cliente vuelve a
  // pedir el resumen de la caja que lo contiene, sin recargar la página y
  // esté esa caja abierta o cerrada.
  useEffect(() => {
    cargarResumen(cajaSeleccionada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaSeleccionada?.id, cajaSeleccionada?.total_cobros, cajaSeleccionada?.total_gastos, cajaSeleccionada?.estado, pagos])

  // Egresos de la caja que se está viendo. Los subtotales F / SF solo cuentan
  // los vigentes (un gasto anulado no es plata que salió).
  const gastosDeLaCaja = useMemo(
    () => todosGastos.filter((g) => g.caja_id === cajaSeleccionada?.id),
    [todosGastos, cajaSeleccionada?.id],
  )

  const subtotalesGasto = useMemo(() => {
    let f = 0, sf = 0
    for (const g of gastosDeLaCaja) {
      if (g.estado === 'anulado') continue
      if (g.tipo_comprobante === 'F') f += Number(g.monto) || 0
      else sf += Number(g.monto) || 0
    }
    return { f, sf, total: f + sf }
  }, [gastosDeLaCaja])

  // Nombre de la categoría: la verdad es la tabla `categorias_gasto`; el mapa
  // de slugs queda como fallback para un gasto de una categoría borrada.
  const nombreCategoria = useCallback((g) => {
    const cat = (categoriasGasto || []).find((c) => c.id === g.categoria_id)
    return cat?.nombre || CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria
  }, [categoriasGasto])

  // PDF del cierre: lo genera la Edge Function con los mismos números del
  // resumen (resumen_cierre_caja), y se abre en una pestaña nueva — en iPhone
  // eso lo muestra en el visor nativo, con compartir e imprimir.
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const handleDescargarPdf = useCallback(async () => {
    if (!cajaSeleccionada?.id) return
    setGenerandoPdf(true)
    try {
      await descargarCierrePdf(cajaSeleccionada.id)
    } catch (err) {
      toast(err.message || 'No pudimos generar el PDF.', { tone: 'error' })
    } finally {
      setGenerandoPdf(false)
    }
  }, [cajaSeleccionada?.id, toast])

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
      <div className="space-y-grid">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="space-y-6 anim-fade-up-page">
      {/* UNA sola barra (nov 2026): antes eran tres piezas apiladas — la fila de
          fecha/estado/Historial, una segunda fila solo-mobile y, más abajo, la
          fila de acciones de la caja cerrada. Ahora va todo junto: a la
          izquierda el navegador de fecha, el toggle ARS/USD y el chip de
          estado; a la derecha las acciones. Los botones van todos en neutro y
          con la misma altura: el único color de la barra es el chip de estado.
          En <lg las acciones bajan a una segunda fila que scrollea en
          horizontal con el difuminado de los bordes (mismo recurso que
          SegmentedScroll). */}
      <ToolbarSticky>
      <div className="toolbar-40 no-print space-y-3 xl:space-y-0 xl:flex xl:items-center xl:gap-2 2xl:gap-3">
        {/* Izquierda (fecha + ARS/USD + chip): una sola fila desde lg, para que
            la toolbar de desktop nunca pase de 2 filas (regla de CLAUDE.md,
            "Toolbars sticky de desktop"). Desde xl se disuelve y comparte la
            fila con las acciones. */}
        <div className="space-y-3 lg:space-y-0 lg:flex lg:items-center lg:gap-3 xl:contents">
        <div className="flex items-center gap-3 xl:contents">
          <button onClick={() => setSelectedDate((d) => shiftDate(d, -1))} className="shrink-0 p-3 md:p-0 md:w-10 md:h-10 md:min-h-0 md:min-w-0 flex items-center justify-center bg-surface hover:bg-surface anim-colors border border-line rounded-full text-ink-2 transition-all min-w-[44px] min-h-[44px]" title="Día anterior">
            <ChevronLeft size={16} />
          </button>
          <DateInput value={selectedDate} onChange={(v) => v && setSelectedDate(v)} max={todayStr()} className="[&_.field]:bg-card flex-1 min-w-0 lg:flex-none lg:w-[148px] 2xl:w-[164px]" />
          <button onClick={() => setSelectedDate((d) => shiftDate(d, 1))} disabled={esHoy} className="shrink-0 p-3 md:p-0 md:w-10 md:h-10 md:min-h-0 md:min-w-0 flex items-center justify-center bg-surface hover:bg-surface anim-colors disabled:opacity-30 disabled:cursor-not-allowed border border-line rounded-full text-ink-2 transition-all min-w-[44px] min-h-[44px]" title="Día siguiente">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* En pantallas chicas el chip baja de línea si no entra, en vez de cortarse. */}
        <div className="flex flex-wrap items-center gap-3 xl:contents">
          {!esHoy && (
            <button onClick={() => setSelectedDate(todayStr())} className={`${CLASE_ACCION} shrink-0`}>
              Volver a Hoy
            </button>
          )}
          <MonedaSwitch
            moneda={mv.moneda} onChange={mv.setMoneda} cotizacion={mv.cotizacion}
            fecha={mv.fecha} stale={mv.stale} compacto
          />
          {/* Único color de la barra. */}
          {cajaSeleccionada && (
            <span
              title={estadoCajaTitle}
              className={`text-label inline-flex items-center px-4 h-11 md:h-10 rounded-full border whitespace-nowrap shrink-0 ${cajaSeleccionada.estado === 'cerrada' ? 'bg-danger-soft text-danger border-danger/30' : 'bg-success-soft text-success-ink border-success/30'}`}
            >
              {estadoCajaTexto}
            </span>
          )}
        </div>
        </div>

        <div className="hidden xl:block xl:flex-1" />

        {/* Acciones. Siempre una fila que scrollea en horizontal si no entra,
            con el difuminado en los bordes: abajo de xl va en su propia fila;
            desde xl comparte la fila con la fecha y el chip. */}
        <div
          ref={accionesRef}
          className="scroll-x-snap flex items-center gap-3 xl:gap-2 2xl:gap-3 min-w-0 -mx-page px-page xl:mx-0 xl:px-0"
          style={{ maskImage: maskAcciones, WebkitMaskImage: maskAcciones }}
        >
          {cajaSeleccionada?.estado === 'cerrada' && (
            <>
              <button onClick={() => window.print()} aria-label="Imprimir A4" title="Imprimir A4" className={CLASE_ACCION}>
                <Printer size={14} /> <span className="hidden 2xl:inline">Imprimir A4</span>
              </button>
              {/* La impresión A4 de siempre no cambia; el PDF es el mismo
                  documento que se adjunta al aviso de cierre (nov 2026). */}
              <button
                onClick={handleDescargarPdf}
                disabled={generandoPdf}
                aria-label="Descargar PDF" title="Descargar PDF"
                className={`${CLASE_ACCION} disabled:opacity-40`}
              >
                <FileDown size={14} /> <span className="hidden 2xl:inline">{generandoPdf ? 'Generando…' : 'Descargar PDF'}</span>
              </button>
              <button
                onClick={() => resumen && descargarCierreCaja(resumen, { exportadoPorNombre: perfil?.nombre || perfil?.usuario || 'Usuario' })}
                disabled={!resumen}
                aria-label="Exportar CSV" title="Exportar CSV"
                className={`${CLASE_ACCION} disabled:opacity-40`}
              >
                <Download size={14} /> <span className="hidden 2xl:inline">Exportar CSV</span>
              </button>
              {/* Reemplaza al banner amarillo: mismo flujo, sin color. */}
              {cajaSeleccionada.arqueo_pendiente && (
                <button onClick={() => setMostrarCierre(true)} className={CLASE_ACCION}>
                  Hacer arqueo y Z
                </button>
              )}
              {!reabriendo && puedeReabrir && (
                <button onClick={() => setReabriendo(true)} className={CLASE_ACCION}>
                  Reabrir Caja
                </button>
              )}
            </>
          )}
          {cajaSeleccionada?.estado === 'abierta' && (
            <button onClick={() => setMostrarCierre(true)} className={CLASE_ACCION}>
              <Lock size={14} /> Cerrar Caja
            </button>
          )}
        </div>
      </div>
      </ToolbarSticky>

      {/* Estado A: sin caja */}
      {!cajaSeleccionada && (
        esHoy ? (
          <div className="card-surface card-pad py-10 no-print text-center space-y-6">
            <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto border border-gold-300">
              <Wallet className="w-10 h-10 text-ink" />
            </div>
            <h2 className="text-label text-card-title text-ink">Caja no iniciada</h2>
            <p className="text-ink-2 text-body max-w-md mx-auto">Abrí la caja del día para empezar a registrar cobros y gastos. Siempre arranca en cero.</p>
            <div className="max-w-xs mx-auto">
              <LoadingButton
                onClick={handleAbrirCaja}
                loading={abriendo}
                loadingText="Abriendo..."
                className="text-label w-full bg-card border border-line hover:bg-surface anim-press px-8 py-4 rounded-full text-ink"
              >
                Abrir Caja de Hoy
              </LoadingButton>
            </div>
          </div>
        ) : (
          <div className="card-surface card-pad py-10 no-print text-center">
            <p className="text-label text-ink-2">Sin movimientos registrados este día.</p>
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
              clamp + nowrap) en vez de 1 con text-stat y 3 con
              text-2xl fijo — eso partía los montos largos ($ 239.947.560)
              en dos renglones en 375px. Título siempre en una línea
              (truncate), ícono 32px arriba a la derecha igual en las
              cuatro, el pill de la primera con overflow-hidden/truncate
              para que nunca se salga de la card. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-grid">
            <div className="card-surface card-pad min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-label text-ink-2">Neto en caja</p>
                <div className="shrink-0 w-8 h-8 rounded-inner bg-surface flex items-center justify-center text-ink-2"><Wallet size={16} /></div>
              </div>
              <MontoStat fmt={fmtM} value={cajaSeleccionada.total_neto} className="text-ink mb-2" />
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-soft text-success-ink text-label font-medium max-w-full overflow-hidden mt-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                <span className="truncate" title="Arqueado en tiempo real">Arqueado en tiempo real</span>
              </span>
            </div>
            <div className="card-surface card-pad min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-label text-ink-2">Ingresos</p>
                <div className="shrink-0 w-8 h-8 rounded-inner bg-success-soft flex items-center justify-center text-success-ink"><ArrowDownRight size={16} /></div>
              </div>
              <MontoStat fmt={fmtM} value={cajaSeleccionada.total_cobros} size="md" className="text-success-ink mb-2" />
              <p className="text-label text-ink-2 mt-auto">{movimientos.filter((m) => m.tipo_movimiento === 'ingreso' && m.estado !== 'anulado').length} cobro{movimientos.filter((m) => m.tipo_movimiento === 'ingreso').length === 1 ? '' : 's'} acreditado{movimientos.filter((m) => m.tipo_movimiento === 'ingreso').length === 1 ? '' : 's'}</p>
            </div>
            <div className="card-surface card-pad min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-label text-ink-2">Egresos</p>
                <div className="shrink-0 w-8 h-8 rounded-inner bg-surface flex items-center justify-center text-ink-2"><ArrowUpRight size={16} /></div>
              </div>
              <MontoStat fmt={fmtM} value={cajaSeleccionada.total_gastos} size="md" className="text-ink mb-2" />
              <p className="text-label text-ink-2 mt-auto">{todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id && g.estado !== 'anulado').length > 0 ? `${todosGastos.filter((g) => g.caja_id === cajaSeleccionada.id).length} gasto(s) cargado(s)` : 'Sin retiros cargados'}</p>
            </div>
            <div className="card-surface card-pad min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-label text-ink-2">Total esperado</p>
                <div className="shrink-0 w-8 h-8 rounded-inner bg-surface flex items-center justify-center text-ink-2"><Banknote size={16} /></div>
              </div>
              <MontoStat fmt={fmtM} value={totalEsperadoPreview} size="md" className="text-ink mb-2" />
              <p className="text-label text-ink-2 mt-auto">Todos los medios — ver desglose</p>
            </div>
          </div>

          <div className="lg:flex lg:gap-grid lg:items-start">
            {/* Columna izquierda: tabs + movimientos */}
            <div className="lg:flex-1 lg:min-w-0 space-y-grid">
              <div className="card-surface card-pad space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {TABS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTab(t.value)}
                        className={`px-4 py-2 rounded-full text-label whitespace-nowrap transition-all min-h-11 ${
                          tab === t.value ? 'bg-ink text-on-ink' : 'bg-surface text-ink-2 hover:bg-line'
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
                    <p className="text-label text-ink-2">Sin movimientos con este filtro.</p>
                  ) : (
                    <>
                      {/* Desktop: tabla real (mock) */}
                      <div className="hidden xl:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-label text-ink-2 border-b border-line">
                              <th className="pb-3 px-2">Hora</th>
                              <th className="pb-3 px-2">Tipo</th>
                              <th className="pb-3 px-2">Cliente / Unidad</th>
                              <th className="pb-3 px-2">Concepto</th>
                              <th className="pb-3 px-2">Comprobante</th>
                              <th className="pb-3 px-2">Medio</th>
                              <th className="pb-3 px-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-divider text-label">
                            {movimientosFiltrados.map((m) => (
                              <tr
                                key={`${m.tipo_movimiento}-${m.movimiento_id}`}
                                onClick={() => abrirDetalleMovimiento(m)}
                                className={`hover:bg-row-hover cursor-pointer anim-colors ${m.estado === 'anulado' ? 'opacity-40' : ''}`}
                              >
                                <td className="py-3 px-2 text-ink-2 font-medium whitespace-nowrap">{formatHora(m.fecha_hora)}</td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label font-medium ${m.tipo_movimiento === 'ingreso' ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${m.tipo_movimiento === 'ingreso' ? 'bg-success' : 'bg-danger'}`} />
                                    {m.tipo_movimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
                                  </span>
                                </td>
                                <td className="py-3 px-2">
                                  <span className={`block text-ink ${m.estado === 'anulado' ? 'line-through' : ''}`}>{m.cliente_proveedor || 'S/N'}</span>
                                  {m.unidad && <span className="block text-ink-2">{emojiEnTexto(m.unidad)}</span>}
                                </td>
                                <td className="py-3 px-2 text-ink-2">{m.concepto}</td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  {m.comprobante ? (
                                    <span className="px-2 py-1 rounded-icon bg-surface text-ink-2 text-label font-semibold">{m.comprobante}</span>
                                  ) : (
                                    <span className="text-ink-2 text-label">Sin comprobante</span>
                                  )}
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap text-ink-2">{MEDIO_PAGO_LABEL[m.medio_pago] || m.medio_pago}</td>
                                <td className={`py-3 px-2 text-right font-semibold tabular-nums whitespace-nowrap ${m.monto < 0 ? 'text-danger' : 'text-ink'}`}>{fmtM(m.monto)}</td>
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
                      <div className="xl:hidden space-y-2">
                        {movimientosFiltrados.map((m) => (
                          <button
                            key={`${m.tipo_movimiento}-${m.movimiento_id}`}
                            onClick={() => abrirDetalleMovimiento(m)}
                            className={`w-full flex flex-col gap-1 p-3 bg-surface rounded-inner text-left whitespace-normal transition-all ${m.estado === 'anulado' ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 w-6 h-6 rounded-swatch bg-card flex items-center justify-center ${m.tipo_movimiento === 'ingreso' ? 'text-success-ink' : 'text-danger'}`}>
                                  {m.tipo_movimiento === 'ingreso' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                </span>
                                <p className={`text-body font-semibold text-ink truncate min-w-0 ${m.estado === 'anulado' ? 'line-through' : ''}`} title={m.concepto}>{m.concepto}</p>
                              </div>
                              <span className={`text-body font-semibold tabular-nums whitespace-nowrap shrink-0 ${m.monto < 0 ? 'text-danger' : 'text-success-ink'}`}>{fmtM(m.monto)}</span>
                            </div>
                            <p className="text-label text-ink-2 break-words pl-8">
                              {m.cliente_proveedor}{m.unidad ? ` · ${emojiEnTexto(m.unidad)}` : ''} · {MEDIO_PAGO_LABEL[m.medio_pago] || m.medio_pago} · {formatHora(m.fecha_hora)}
                            </p>
                            {m.comprobante && (
                              <span className="inline-block self-start ml-8 px-2 py-1 rounded-swatch bg-card text-label font-semibold text-ink-2">{m.comprobante}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )
                )}

                {tab === 'facturas' && (
                  (resumen?.facturas || []).length === 0 ? <p className="text-label text-ink-2">Sin facturas todavía.</p> : (
                    <div className="space-y-2">
                      {resumen.facturas.map((f) => (
                        <div key={f.etiqueta} className="flex justify-between py-2 border-b border-line last:border-0">
                          <span className="text-body text-ink-2">{f.etiqueta}</span>
                          <span className="text-body font-semibold text-ink tabular-nums">{fmtM(f.monto_total)}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'recibos' && (
                  (resumen?.recibos || []).length === 0 ? <p className="text-label text-ink-2">Sin recibos todavía.</p> : (
                    <div className="space-y-2">
                      {resumen.recibos.map((r) => (
                        <div key={r.etiqueta} className="flex justify-between py-2 border-b border-line last:border-0">
                          <span className="text-body text-ink-2">{r.etiqueta}</span>
                          <span className="text-body font-semibold text-ink tabular-nums">{fmtM(r.monto_total)}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'sin_comprobante' && (
                  (resumen?.sin_comprobante || []).length === 0 ? <p className="text-label text-ink-2">Todos los pagos tienen comprobante.</p> : (
                    <div className="space-y-2">
                      {resumen.sin_comprobante.map((p) => (
                        <button
                          key={p.pago_id}
                          onClick={() => { const pago = pagos.find((x) => x.id === p.pago_id); if (pago) setPagoSeleccionado(pago) }}
                          className="w-full flex justify-between py-2 px-2 border-b border-line last:border-0 hover:bg-surface rounded-icon text-left"
                        >
                          <span className="text-body text-ink-2">{p.cliente || 'S/N'} — {p.concepto}</span>
                          <span className="text-body font-semibold text-ink tabular-nums">{fmtM(p.monto)}</span>
                        </button>
                      ))}
                    </div>
                  )
                )}

                {tab === 'gastos' && (
                  gastosDeLaCaja.length === 0 ? <p className="text-label text-ink-2">Sin gastos todavía.</p> : (
                    <div className="space-y-2">
                      {/* Subtotales F / SF / total arriba de la lista: es lo
                          primero que mira la contadora. Salen de los gastos
                          vigentes de esta caja, no del total_gastos de la
                          fila (que no distingue tipo). */}
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-1 border-b border-line">
                        <div className="flex items-center gap-2 h-8 px-3 rounded-full bg-gold-100 border border-gold-300 text-label whitespace-nowrap shrink-0">
                          <span className="text-ink-2">Con factura (F):</span>
                          <span className="text-ink font-semibold tabular-nums">{fmtM(subtotalesGasto.f)}</span>
                        </div>
                        <div className="flex items-center gap-2 h-8 px-3 rounded-full bg-surface border border-line text-label whitespace-nowrap shrink-0">
                          <span className="text-ink-2">Sin factura (SF):</span>
                          <span className="text-ink font-semibold tabular-nums">{fmtM(subtotalesGasto.sf)}</span>
                        </div>
                        <div className="flex items-center gap-2 h-8 px-3 rounded-full bg-surface text-label whitespace-nowrap shrink-0">
                          <span className="text-ink-2">Total:</span>
                          <span className="text-ink font-semibold tabular-nums">{fmtM(subtotalesGasto.total)}</span>
                        </div>
                      </div>
                      {gastosDeLaCaja.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGastoSeleccionado(g)}
                          className={`w-full flex justify-between items-center py-3 px-2 border-b border-line last:border-0 hover:bg-surface rounded-icon text-left ${g.estado === 'anulado' ? 'opacity-40' : ''}`}
                        >
                          <div className="min-w-0 flex items-start gap-2">
                            <BadgeFactura tipo={g.tipo_comprobante} className="mt-0.5" />
                            <div className="min-w-0">
                              <p className={`text-body font-semibold text-ink-2 truncate ${g.estado === 'anulado' ? 'line-through' : ''}`} title={g.descripcion}>{g.descripcion}</p>
                              <p className="text-label text-ink-2 truncate" title={g.proveedor || undefined}>
                                {nombreCategoria(g)} · {formatHora(g.created_at)}
                                {g.proveedor ? ` · ${g.proveedor}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-body font-semibold text-danger tabular-nums shrink-0 ml-3">{fmtM(g.monto)}</span>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Mobile/tablet: desglose por medio + alerta + acciones, abajo del todo */}
              <div className="lg:hidden space-y-grid">
                {resumen?.por_medio?.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {resumen.por_medio.map((m) => (
                      <div key={m.medio} className="flex items-center gap-2 h-8 px-3 rounded-full bg-surface text-label whitespace-nowrap shrink-0">
                        <span className="text-ink-2">{MEDIO_PAGO_LABEL_CORTO[m.medio] || m.medio}:</span>
                        <span className="font-semibold text-ink tabular-nums">{fmtM(m.neto)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {resumen?.sin_comprobante?.length > 0 && (
                  <div className="flex items-start gap-3 p-4 bg-gold-100 border border-gold-300 rounded-inner">
                    <AlertTriangle className="text-ink shrink-0 mt-1" size={16} />
                    <p className="text-label text-ink-2">
                      Hay {resumen.sin_comprobante.length} pago{resumen.sin_comprobante.length > 1 ? 's' : ''} sin comprobante cargado todavía.
                    </p>
                  </div>
                )}
                {/* "Cerrar Caja" vive en la barra de arriba (nov 2026). */}
                <div className="hidden md:flex gap-4">
                  <button onClick={() => setMostrarGasto(true)} className="text-label flex items-center gap-2 px-6 py-3 bg-surface hover:bg-line text-ink rounded-full border border-line transition-all">
                    <Plus size={16} /> Registrar Gasto
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
                <button onClick={() => setMostrarGasto(true)} className="text-label w-full py-4 bg-surface hover:bg-line border border-line text-ink rounded-inner transition-all flex items-center justify-center gap-2 min-h-[44px]">
                  <Plus size={16} /> Registrar Gasto
                </button>
              </div>
            </div>

            {/* Columna derecha — solo >=1024px: desglose por medio con tiles + acciones (mock). */}
            <aside className="hidden lg:flex lg:w-80 lg:shrink-0 flex-col gap-4 sticky top-3 self-start">
              {resumen?.por_medio?.length > 0 && (
                <div className="card-surface card-pad space-y-4">
                  <h3 className="text-base font-semibold text-ink">Desglose por Medio de Pago</h3>
                  <div className="space-y-3">
                    {resumen.por_medio.map((m) => (
                      <FilaMedioPago key={m.medio} medio={m.medio} monto={m.neto} fmt={fmtM} negativo={Number(m.neto) < 0} />
                    ))}
                  </div>
                </div>
              )}

              {resumen?.sin_comprobante?.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-gold-100 border border-gold-300 rounded-inner">
                  <AlertTriangle className="text-ink shrink-0 mt-1" size={16} />
                  <p className="text-label text-ink-2">
                    Hay {resumen.sin_comprobante.length} pago{resumen.sin_comprobante.length > 1 ? 's' : ''} sin comprobante cargado todavía.
                  </p>
                </div>
              )}

              <button onClick={() => setMostrarGasto(true)} className="flex items-center justify-center gap-2 px-6 py-4 bg-card border border-line hover:bg-surface text-ink rounded-full font-medium text-body transition-all">
                <Plus size={18} className="text-ink-2" /> Registrar gasto
              </button>
            </aside>
          </div>
        </div>
      )}

      {/* Estado D: caja cerrada — resumen del día */}
      {cajaSeleccionada && cajaSeleccionada.estado === 'cerrada' && (
        <>
          {reabriendo && puedeReabrir && (
            <div className="card-surface card-pad no-print space-y-4 border-gold-300">
              <div className="flex items-center justify-between">
                <h3 className="text-label text-ink">Reabrir caja</h3>
                <button onClick={() => { setReabriendo(false); setMotivoReapertura('') }} className="text-ink-2 hover:text-ink"><X size={18} /></button>
              </div>
              <textarea
                rows={2} value={motivoReapertura} onChange={(e) => setMotivoReapertura(e.target.value)}
                placeholder="Motivo de la reapertura (obligatorio)"
                className="w-full bg-surface rounded-inner px-4 py-3 text-ink text-base md:text-body outline-none resize-none border border-transparent focus:ring-2 focus:ring-gold"
              />
              <button onClick={handleReabrir} disabled={!motivoReapertura.trim()} className="text-label w-full py-3 bg-card border border-line hover:bg-surface anim-press disabled:opacity-50 rounded-full transition-all text-ink">
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
            {resumenLoading ? <p className="text-label text-ink-2">Cargando resumen...</p> : <ResumenCaja resumen={resumen} />}
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
        ingresosDia={resumen?.totales?.ingresos || 0}
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

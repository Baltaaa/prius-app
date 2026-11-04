import { useMemo, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Receipt, Target, Percent,
} from 'lucide-react'
import { useData } from '../../context/DataProvider'
import { useAuth } from '../../context/AuthProvider'
import { useDialog } from '../../context/DialogProvider'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import ToolbarSticky from '../../components/brand/ToolbarSticky'
import ReportesControles from '../../components/reportes/ReportesControles'
import ScrollFade from '../../components/ui/ScrollFade'
import Skeleton from '../../components/ui/Skeleton'
import { formatPesos, formatPesosCompacto, formatPorcentaje, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_EMOJI } from '../../lib/pagos'
import {
  PERIODOS, construirSerie, totalesDe, proyectarPeriodoEnCurso, desglosePorMedio,
} from '../../lib/reportes'
import {
  montoEnMoneda, descargarReporteCsv, textoReporteWhatsApp, linkWhatsAppReporte, imprimirReporte,
} from '../../lib/export/reportesExport'

// Reportes (31/10/2026, rediseño): lo que el dueño quiere ver de un vistazo —
// ingresos, egresos, neto y margen, agrupados por día / semana / mes / año,
// con la variación contra el período anterior, el desglose por medio de pago
// y la proyección del período en curso.
//
// Todos los números salen de lib/reportes.js, y el CSV / WhatsApp / impresión
// consumen EXACTAMENTE la misma serie (lib/export/reportesExport.js) — la
// pantalla y lo exportado no pueden divergir.
//
// Moneda: el peso es la fuente de verdad (pagos.monto siempre en pesos). El
// switch a USD es de presentación: divide por la cotización vigente, y por
// eso el encabezado siempre aclara con cuál se convirtió.

const hoyIso = () => new Date().toISOString().split('T')[0]
const haceMeses = (n) => {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().split('T')[0]
}

// Tile de KPI (mismo lenguaje que los tiles del Plano): etiqueta arriba, valor
// grande y una línea de apoyo. Hasta xl el monto va en formato compacto
// ($142,4M) para que los cuatro entren sin truncar; desde xl, completo. El
// `title` siempre trae el monto completo.
function Kpi({ icono: Icono, label, valor, valorCompacto, sub, tono = 'neutro' }) {
  const color = tono === 'positivo' ? 'text-success-ink' : tono === 'negativo' ? 'text-danger' : 'text-ink'
  return (
    <div data-card-compacta title={valor} className="card-surface p-3 xl:p-4 min-w-0 flex flex-col justify-center">
      <p className="flex items-center gap-2 text-label text-ink-2">
        <Icono size={14} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className={`text-card-title tabular-nums whitespace-nowrap mt-1 ${color}`}>
        <span className="xl:hidden">{valorCompacto ?? valor}</span>
        <span className="hidden xl:inline">{valor}</span>
      </p>
      {sub && <p className="text-label text-ink-2 mt-1">{sub}</p>}
    </div>
  )
}

// "Promedio mensual", no "Promedio por mensual".
const PROMEDIO_LABEL = { dia: 'Promedio diario', semana: 'Promedio semanal', mes: 'Promedio mensual', anio: 'Promedio anual' }

// Partir de casi cero infla la variación a números sin sentido (un mes de
// $30 contra uno de $142M daba "+473.849.900%"). Por encima de +999% se
// muestra acotado: el dato útil ahí es "se disparó", no la cifra exacta.
const TOPE_VARIACION = 999

function Variacion({ pct }) {
  if (pct == null) return <span className="text-ink-2">—</span>
  const sube = pct >= 0
  const Icono = sube ? TrendingUp : TrendingDown
  const excede = Math.abs(pct) > TOPE_VARIACION
  const texto = excede
    ? `${sube ? '>+' : '<−'}${TOPE_VARIACION}%`
    : `${sube ? '+' : ''}${formatPorcentaje(pct, 1)}`
  return (
    <span
      title={excede ? formatPorcentaje(pct, 1) : undefined}
      className={`inline-flex items-center gap-1 tabular-nums ${sube ? 'text-success-ink' : 'text-danger'}`}
    >
      <Icono size={13} />
      {texto}
    </span>
  )
}

export default function Reportes() {
  const { pagos, todosGastos, loading } = useData()
  const { perfil } = useAuth()
  const { toast } = useDialog()
  const tc = useTipoCambio()
  const ready = useInitialLoad(loading)

  const [periodo, setPeriodo] = useState('mes')
  const [moneda, setMoneda] = useState('ARS')
  const [desde, setDesde] = useState(() => haceMeses(12))
  const [hasta, setHasta] = useState(hoyIso)

  const serie = useMemo(
    () => construirSerie({ pagos, gastos: todosGastos, periodo, desde, hasta }),
    [pagos, todosGastos, periodo, desde, hasta],
  )
  const totales = useMemo(() => totalesDe(serie), [serie])
  const proyeccion = useMemo(() => proyectarPeriodoEnCurso(serie, periodo), [serie, periodo])
  const porMedio = useMemo(() => desglosePorMedio(serie), [serie])

  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label || periodo
  const cot = tc.valor
  const m = (v) => montoEnMoneda(v, moneda, cot)
  // En pesos, formato compacto para los tiles chicos; en dólares el monto ya es corto.
  const mc = (v) => (moneda === 'USD' ? m(v) : formatPesosCompacto(v))
  const faltaCotizacion = moneda === 'USD' && !cot

  const datosExport = { serie, totales, proyeccion, moneda, cotizacion: cot, periodoLabel, desde, hasta, porMedio }
  const textoWa = useMemo(() => textoReporteWhatsApp(datosExport), [serie, totales, proyeccion, moneda, cot, periodoLabel, desde, hasta])
  const linkWa = linkWhatsAppReporte(perfil?.telefono, textoWa)

  const handleWhatsApp = () => {
    if (!linkWa) {
      toast('Cargá tu teléfono en Mi cuenta para poder enviarte el reporte.', { tone: 'error' })
      return
    }
    window.open(linkWa, '_blank', 'noopener,noreferrer')
  }

  if (!ready) {
    return (
      <div className="space-y-grid">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-grid">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const maxIngreso = Math.max(...serie.map((r) => r.ingresos), 1)

  return (
    <div className="space-y-grid animate-premium-fade">
      {/* Controles: viven en la zona sticky superior, junto a la topbar. */}
      <ToolbarSticky>
        <ReportesControles
          periodo={periodo}
          setPeriodo={setPeriodo}
          moneda={moneda}
          setMoneda={setMoneda}
          desde={desde}
          hasta={hasta}
          setDesde={setDesde}
          setHasta={setHasta}
          onWhatsApp={handleWhatsApp}
          linkWa={linkWa}
          onCsv={() => descargarReporteCsv(datosExport)}
          onImprimir={imprimirReporte}
        />
      </ToolbarSticky>

      {/* KPIs: lo primero que se ve. 2x2 en mobile, una fila de 4 desde md. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-grid">
        <Kpi icono={Wallet} label="Ingresos" valor={m(totales.ingresos)} valorCompacto={mc(totales.ingresos)} sub={`${totales.cantidadPagos} cobros`} tono="positivo" />
        <Kpi icono={Receipt} label="Egresos" valor={m(totales.egresos)} valorCompacto={mc(totales.egresos)} tono="negativo" />
        <Kpi icono={TrendingUp} label="Neto" valor={m(totales.neto)} valorCompacto={mc(totales.neto)} sub={`Margen ${formatPorcentaje(totales.margen, 1)}`} />
        <Kpi icono={Percent} label="Ticket promedio" valor={m(totales.ticketPromedio)} valorCompacto={mc(totales.ticketPromedio)} sub={`${PROMEDIO_LABEL[periodo] || 'Promedio'}: ${mc(totales.promedioPorPeriodo)}`} />
      </div>

      {faltaCotizacion && (
        <div className="no-print p-3 bg-gold-100 border border-gold-300 rounded-inner text-label text-ink">
          No hay cotización del dólar disponible. Los importes en USD se muestran como “—”.
        </div>
      )}

      {/* Encabezado (también se imprime) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-card-title">Prius Playa Grande — Reporte {periodoLabel}</h1>
        <p className="text-label">
          {desde ? formatFecha(desde) : '—'} al {hasta ? formatFecha(hasta) : '—'} · Moneda: {moneda}
          {moneda === 'USD' && cot ? ` (cotización ${formatPesos(cot)})` : ''}
        </p>
      </div>

      {/* Proyección */}
      {proyeccion && (
        <div className="card-surface card-pad flex flex-wrap items-center gap-4">
          <span className="w-9 h-9 shrink-0 rounded-icon bg-gold-100 text-ink flex items-center justify-center"><Target size={16} /></span>
          <div className="min-w-0">
            <p className="text-label text-ink-2">Proyección · {proyeccion.label}</p>
            <p className="text-label text-ink-2 mt-1">
              {formatPorcentaje(proyeccion.pctTranscurrido, 0)} transcurrido · si sigue este ritmo
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex gap-6">
            <div>
              <p className="text-label text-ink-2">Ingresos</p>
              <p className="text-body text-ink tabular-nums">{m(proyeccion.ingresosProyectados)}</p>
              <p className="text-label text-ink-2">hoy {m(proyeccion.ingresosHastaAhora)}</p>
            </div>
            <div>
              <p className="text-label text-ink-2">Neto</p>
              <p className="text-body text-ink tabular-nums">{m(proyeccion.netoProyectado)}</p>
              <p className="text-label text-ink-2">hoy {m(proyeccion.netoHastaAhora)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-grid">
        {/* Evolución */}
        <div className="card-surface xl:col-span-2 overflow-hidden flex flex-col">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-label text-ink-2">Evolución · {periodoLabel}</p>
            <span className="text-label text-ink-2">{serie.length} períodos</span>
          </div>
          {serie.length === 0 ? (
            <p className="text-label px-4 pb-4 text-ink-2">Sin movimientos en el rango elegido.</p>
          ) : (
            <ScrollFade wrapperClassName="max-h-[420px] print:max-h-none print:overflow-visible" className="overflow-y-auto print:max-h-none print:overflow-visible">
              <table className="w-full text-body">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-left text-label text-ink-2 border-b border-line">
                    <th className="px-4 py-2 font-medium">Período</th>
                    <th className="px-3 py-2 font-medium text-right">Ingresos</th>
                    <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Egresos</th>
                    <th className="px-3 py-2 font-medium text-right">Neto</th>
                    <th className="px-4 py-2 font-medium text-right">Var.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...serie].reverse().map((r) => (
                    <tr key={r.clave} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <span className="text-ink font-medium">{r.label}</span>
                        <span className="block w-full h-1 mt-1 rounded-full bg-surface overflow-hidden">
                          <span className="block h-full bg-gold rounded-full" style={{ width: `${(r.ingresos / maxIngreso) * 100}%` }} />
                        </span>
                      </td>
                      {/* En mobile los montos van compactos ($48,8M) para que la tabla entre sin
                          partir el "$" ni cortar la columna Var.; desde sm, completos. */}
                      <td title={m(r.ingresos)} className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-ink"><span className="sm:hidden">{mc(r.ingresos)}</span><span className="hidden sm:inline">{m(r.ingresos)}</span></td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-ink-2 hidden sm:table-cell">{m(r.egresos)}</td>
                      <td title={m(r.neto)} className={`px-3 py-3 text-right tabular-nums whitespace-nowrap font-semibold ${r.neto >= 0 ? 'text-ink' : 'text-danger'}`}><span className="sm:hidden">{mc(r.neto)}</span><span className="hidden sm:inline">{m(r.neto)}</span></td>
                      <td className="px-4 py-3 text-right text-label whitespace-nowrap"><Variacion pct={r.variacionIngresos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFade>
          )}
        </div>

        {/* Medios de pago */}
        <div className="card-surface overflow-hidden">
          <p className="px-4 pt-3 pb-2 text-label text-ink-2">Por medio de pago</p>
          {porMedio.length === 0 ? (
            <p className="text-label px-4 pb-4 text-ink-2">Sin cobros en el rango.</p>
          ) : (
            <div className="px-4 pb-4 space-y-3">
              {porMedio.map((x) => (
                <div key={x.medio}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-body text-ink truncate">
                      {MEDIO_PAGO_EMOJI[x.medio] || ''} {MEDIO_PAGO_LABEL[x.medio] || x.medio}
                    </span>
                    <span className="text-body tabular-nums text-ink shrink-0">{m(x.monto)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                      <span className="block h-full bg-ink rounded-full" style={{ width: `${x.pct}%` }} />
                    </span>
                    <span className="text-label text-ink-2 tabular-nums shrink-0">{formatPorcentaje(x.pct, 1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

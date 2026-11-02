import { useMemo, useState } from 'react'
import {
  TrendingUp, TrendingDown, Download, Printer, Wallet, Receipt, Target, Percent,
} from 'lucide-react'
import { useData } from '../../context/DataProvider'
import { useAuth } from '../../context/AuthProvider'
import { useDialog } from '../../context/DialogProvider'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import DateInput from '../../components/inputs/DateInput'
import BrandSelect from '../../components/ui/BrandSelect'
import ScrollFade from '../../components/ui/ScrollFade'
import Skeleton from '../../components/ui/Skeleton'
import WhatsAppIcon from '../../components/ui/WhatsAppIcon'
import { formatPesos, formatPorcentaje, formatFecha } from '../../lib/format'
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

function Kpi({ icono: Icono, label, valor, sub, tono = 'neutro' }) {
  const color = tono === 'positivo' ? 'text-success-ink' : tono === 'negativo' ? 'text-danger' : 'text-ink'
  return (
    <div className="card-light rounded-card p-4 flex items-start gap-3">
      <span className="w-9 h-9 shrink-0 rounded-icon bg-surface text-ink-2 flex items-center justify-center">
        <Icono size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-label text-ink-2 uppercase tracking-wider truncate">{label}</p>
        <p className={`text-body tabular-nums mt-0.5 ${color}`}>{valor}</p>
        {sub && <p className="text-label text-ink-2 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

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
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const maxIngreso = Math.max(...serie.map((r) => r.ingresos), 1)

  return (
    <div className="space-y-4 animate-premium-fade">
      {/* Controles */}
      <div className="no-print card-light rounded-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-inner shrink-0">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-icon text-label font-bold transition-colors ${
                periodo === p.value ? 'bg-card text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-surface p-1 rounded-inner shrink-0">
          {['ARS', 'USD'].map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setMoneda(x)}
              className={`px-3 py-1.5 rounded-icon text-label font-bold transition-colors ${
                moneda === x ? 'bg-card text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {x === 'ARS' ? '🇦🇷 Pesos' : '🇺🇸 Dólares'}
            </button>
          ))}
        </div>

        <DateInput value={desde || null} onChange={(v) => setDesde(v || '')} placeholder="Desde" className="w-40" />
        <DateInput value={hasta || null} onChange={(v) => setHasta(v || '')} placeholder="Hasta" min={desde || undefined} className="w-40" />

        <div className="flex-1" />

        <button onClick={handleWhatsApp} disabled={!linkWa} title={linkWa ? 'Enviar a mi WhatsApp' : 'Cargá tu teléfono en Mi cuenta'}
          className="h-10 px-3.5 rounded-inner bg-success hover:bg-success disabled:opacity-40 disabled:cursor-not-allowed text-on-ink flex items-center gap-2 text-body transition-colors">
          <WhatsAppIcon size={15} /> <span className="hidden sm:inline">WhatsApp</span>
        </button>
        <button onClick={() => descargarReporteCsv(datosExport)}
          className="h-10 px-3.5 rounded-inner bg-surface hover:bg-line text-ink flex items-center gap-2 text-body transition-colors">
          <Download size={15} /> <span className="hidden sm:inline">CSV</span>
        </button>
        <button onClick={imprimirReporte}
          className="h-10 px-3.5 rounded-inner bg-surface hover:bg-line text-ink flex items-center gap-2 text-body transition-colors">
          <Printer size={15} /> <span className="hidden sm:inline">Imprimir / PDF</span>
        </button>
      </div>

      {faltaCotizacion && (
        <div className="no-print p-3 bg-gold-100 border border-gold-300 rounded-inner text-xs text-ink">
          No hay cotización del dólar disponible. Los importes en USD se muestran como “—”.
        </div>
      )}

      {/* Encabezado (también se imprime) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">Prius Playa Grande — Reporte {periodoLabel}</h1>
        <p className="text-xs">
          {desde ? formatFecha(desde) : '—'} al {hasta ? formatFecha(hasta) : '—'} · Moneda: {moneda}
          {moneda === 'USD' && cot ? ` (cotización ${formatPesos(cot)})` : ''}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icono={Wallet} label="Ingresos" valor={m(totales.ingresos)} sub={`${totales.cantidadPagos} cobros`} tono="positivo" />
        <Kpi icono={Receipt} label="Egresos" valor={m(totales.egresos)} tono="negativo" />
        <Kpi icono={TrendingUp} label="Neto" valor={m(totales.neto)} sub={`Margen ${formatPorcentaje(totales.margen, 1)}`} />
        <Kpi icono={Percent} label="Ticket promedio" valor={m(totales.ticketPromedio)} sub={`Promedio por ${periodoLabel.toLowerCase()}: ${m(totales.promedioPorPeriodo)}`} />
      </div>

      {/* Proyección */}
      {proyeccion && (
        <div className="card-light rounded-card p-4 flex flex-wrap items-center gap-4">
          <span className="w-9 h-9 shrink-0 rounded-icon bg-gold-100 text-ink flex items-center justify-center"><Target size={16} /></span>
          <div className="min-w-0">
            <p className="text-label text-ink-2 uppercase tracking-wider">Proyección · {proyeccion.label}</p>
            <p className="text-label text-ink-2 mt-0.5">
              {formatPorcentaje(proyeccion.pctTranscurrido, 0)} transcurrido · si sigue este ritmo
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex gap-6">
            <div>
              <p className="text-label text-ink-2 uppercase tracking-wider">Ingresos</p>
              <p className="text-body text-ink tabular-nums">{m(proyeccion.ingresosProyectados)}</p>
              <p className="text-label text-ink-2">hoy {m(proyeccion.ingresosHastaAhora)}</p>
            </div>
            <div>
              <p className="text-label text-ink-2 uppercase tracking-wider">Neto</p>
              <p className="text-body text-ink tabular-nums">{m(proyeccion.netoProyectado)}</p>
              <p className="text-label text-ink-2">hoy {m(proyeccion.netoHastaAhora)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Evolución */}
        <div className="xl:col-span-2 card-light rounded-card card-light-inner overflow-hidden flex flex-col">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-label text-ink-2 uppercase tracking-wider">Evolución · {periodoLabel}</p>
            <span className="text-label text-ink-2">{serie.length} períodos</span>
          </div>
          {serie.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-ink-2 uppercase tracking-widest">Sin movimientos en el rango elegido.</p>
          ) : (
            <ScrollFade className="overflow-y-auto max-h-[420px] print:max-h-none print:overflow-visible">
              <table className="w-full text-body">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-left text-label text-ink-2 uppercase tracking-wider border-b border-line">
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
                      <td className="px-4 py-2.5">
                        <span className="text-ink font-medium">{r.label}</span>
                        <span className="block w-full h-1 mt-1 rounded-full bg-surface overflow-hidden">
                          <span className="block h-full bg-gold rounded-full" style={{ width: `${(r.ingresos / maxIngreso) * 100}%` }} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{m(r.ingresos)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-2 hidden sm:table-cell">{m(r.egresos)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.neto >= 0 ? 'text-ink' : 'text-danger'}`}>{m(r.neto)}</td>
                      <td className="px-4 py-2.5 text-right text-xs"><Variacion pct={r.variacionIngresos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFade>
          )}
        </div>

        {/* Medios de pago */}
        <div className="card-light rounded-card card-light-inner overflow-hidden">
          <p className="px-4 pt-3 pb-2 text-label text-ink-2 uppercase tracking-wider">Por medio de pago</p>
          {porMedio.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-ink-2 uppercase tracking-widest">Sin cobros en el rango.</p>
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
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

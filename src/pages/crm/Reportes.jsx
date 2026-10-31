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
  const color = tono === 'positivo' ? 'text-prius-success' : tono === 'negativo' ? 'text-prius-error' : 'text-black'
  return (
    <div className="card-light rounded-2xl p-4 flex items-start gap-3">
      <span className="w-9 h-9 shrink-0 rounded-lg bg-prius-subtle text-prius-slate flex items-center justify-center">
        <Icono size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-label-md text-prius-slate uppercase tracking-wider truncate">{label}</p>
        <p className={`text-headline-sm tabular-nums mt-0.5 ${color}`}>{valor}</p>
        {sub && <p className="text-body-sm text-prius-slate mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// Partir de casi cero infla la variación a números sin sentido (un mes de
// $30 contra uno de $142M daba "+473.849.900%"). Por encima de +999% se
// muestra acotado: el dato útil ahí es "se disparó", no la cifra exacta.
const TOPE_VARIACION = 999

function Variacion({ pct }) {
  if (pct == null) return <span className="text-prius-muted">—</span>
  const sube = pct >= 0
  const Icono = sube ? TrendingUp : TrendingDown
  const excede = Math.abs(pct) > TOPE_VARIACION
  const texto = excede
    ? `${sube ? '>+' : '<−'}${TOPE_VARIACION}%`
    : `${sube ? '+' : ''}${formatPorcentaje(pct, 1)}`
  return (
    <span
      title={excede ? formatPorcentaje(pct, 1) : undefined}
      className={`inline-flex items-center gap-1 tabular-nums ${sube ? 'text-prius-success' : 'text-prius-error'}`}
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
      toast('Cargá tu teléfono en Perfil y Tarifas para poder enviarte el reporte.', { tone: 'error' })
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
      <div className="no-print card-light rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-prius-subtle p-1 rounded-xl shrink-0">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-lg text-label-md font-bold transition-colors ${
                periodo === p.value ? 'bg-white text-black shadow-sm' : 'text-prius-slate hover:text-black'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-prius-subtle p-1 rounded-xl shrink-0">
          {['ARS', 'USD'].map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setMoneda(x)}
              className={`px-3 py-1.5 rounded-lg text-label-md font-bold transition-colors ${
                moneda === x ? 'bg-white text-black shadow-sm' : 'text-prius-slate hover:text-black'
              }`}
            >
              {x === 'ARS' ? '🇦🇷 Pesos' : '🇺🇸 Dólares'}
            </button>
          ))}
        </div>

        <DateInput value={desde || null} onChange={(v) => setDesde(v || '')} placeholder="Desde" className="w-40" />
        <DateInput value={hasta || null} onChange={(v) => setHasta(v || '')} placeholder="Hasta" min={desde || undefined} className="w-40" />

        <div className="flex-1" />

        <button onClick={handleWhatsApp} disabled={!linkWa} title={linkWa ? 'Enviar a mi WhatsApp' : 'Cargá tu teléfono en Perfil y Tarifas'}
          className="h-10 px-3.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-2 text-title-md transition-colors">
          <WhatsAppIcon size={15} /> <span className="hidden sm:inline">WhatsApp</span>
        </button>
        <button onClick={() => descargarReporteCsv(datosExport)}
          className="h-10 px-3.5 rounded-xl bg-prius-surface hover:bg-hairline text-black flex items-center gap-2 text-title-md transition-colors">
          <Download size={15} /> <span className="hidden sm:inline">CSV</span>
        </button>
        <button onClick={imprimirReporte}
          className="h-10 px-3.5 rounded-xl bg-prius-surface hover:bg-hairline text-black flex items-center gap-2 text-title-md transition-colors">
          <Printer size={15} /> <span className="hidden sm:inline">Imprimir / PDF</span>
        </button>
      </div>

      {faltaCotizacion && (
        <div className="no-print p-3 bg-gold/10 border border-gold/20 rounded-xl text-xs text-black">
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
        <div className="card-light rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-gold/15 text-black flex items-center justify-center"><Target size={16} /></span>
          <div className="min-w-0">
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Proyección · {proyeccion.label}</p>
            <p className="text-body-sm text-prius-slate mt-0.5">
              {formatPorcentaje(proyeccion.pctTranscurrido, 0)} transcurrido · si sigue este ritmo
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex gap-6">
            <div>
              <p className="text-label-md text-prius-slate uppercase tracking-wider">Ingresos</p>
              <p className="text-headline-sm text-black tabular-nums">{m(proyeccion.ingresosProyectados)}</p>
              <p className="text-body-sm text-prius-slate">hoy {m(proyeccion.ingresosHastaAhora)}</p>
            </div>
            <div>
              <p className="text-label-md text-prius-slate uppercase tracking-wider">Neto</p>
              <p className="text-headline-sm text-black tabular-nums">{m(proyeccion.netoProyectado)}</p>
              <p className="text-body-sm text-prius-slate">hoy {m(proyeccion.netoHastaAhora)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Evolución */}
        <div className="xl:col-span-2 card-light rounded-2xl card-light-inner overflow-hidden flex flex-col">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Evolución · {periodoLabel}</p>
            <span className="text-label-md text-prius-muted">{serie.length} períodos</span>
          </div>
          {serie.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-prius-muted uppercase tracking-widest">Sin movimientos en el rango elegido.</p>
          ) : (
            <ScrollFade className="overflow-y-auto max-h-[420px] print:max-h-none print:overflow-visible">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-label-md text-prius-slate uppercase tracking-wider border-b border-hairline">
                    <th className="px-4 py-2 font-medium">Período</th>
                    <th className="px-3 py-2 font-medium text-right">Ingresos</th>
                    <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Egresos</th>
                    <th className="px-3 py-2 font-medium text-right">Neto</th>
                    <th className="px-4 py-2 font-medium text-right">Var.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...serie].reverse().map((r) => (
                    <tr key={r.clave} className="border-b border-hairline/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="text-black font-medium">{r.label}</span>
                        <span className="block w-full h-1 mt-1 rounded-full bg-prius-subtle overflow-hidden">
                          <span className="block h-full bg-gold rounded-full" style={{ width: `${(r.ingresos / maxIngreso) * 100}%` }} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-black">{m(r.ingresos)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-prius-slate hidden sm:table-cell">{m(r.egresos)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.neto >= 0 ? 'text-black' : 'text-prius-error'}`}>{m(r.neto)}</td>
                      <td className="px-4 py-2.5 text-right text-xs"><Variacion pct={r.variacionIngresos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFade>
          )}
        </div>

        {/* Medios de pago */}
        <div className="card-light rounded-2xl card-light-inner overflow-hidden">
          <p className="px-4 pt-3 pb-2 text-label-md text-prius-slate uppercase tracking-wider">Por medio de pago</p>
          {porMedio.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-prius-muted uppercase tracking-widest">Sin cobros en el rango.</p>
          ) : (
            <div className="px-4 pb-4 space-y-3">
              {porMedio.map((x) => (
                <div key={x.medio}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-black truncate">
                      {MEDIO_PAGO_EMOJI[x.medio] || ''} {MEDIO_PAGO_LABEL[x.medio] || x.medio}
                    </span>
                    <span className="text-sm tabular-nums text-black shrink-0">{m(x.monto)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex-1 h-1.5 rounded-full bg-prius-subtle overflow-hidden">
                      <span className="block h-full bg-black rounded-full" style={{ width: `${x.pct}%` }} />
                    </span>
                    <span className="text-label-md text-prius-slate tabular-nums shrink-0">{formatPorcentaje(x.pct, 1)}</span>
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

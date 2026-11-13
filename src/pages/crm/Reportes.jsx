import { useCallback, useMemo, useRef, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Receipt, Percent, Hourglass, CalendarRange,
} from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { useRpc } from '../../hooks/useRpcCache'
import ToolbarSticky from '../../components/brand/ToolbarSticky'
import ReportesControles from '../../components/reportes/ReportesControles'
import {
  BarrasEnElTiempo, BarrasApiladasFSF, Dona, BarrasHorizontales,
  LineaOcupacion, AnilloOcupacion, Sparkline, ProgresoTemporada, useOscuro,
} from '../../components/reportes/Graficos'
import BadgeFactura from '../../components/crm/BadgeFactura'
import Skeleton from '../../components/ui/Skeleton'
import { formatMonto, formatMontoCompacto, formatPorcentaje, formatFecha } from '../../lib/format'
import { hoyAR } from '../../lib/fechas'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_EMOJI } from '../../lib/pagos'
import { unidadEmoji } from '../../lib/unidadIcono'
import { rangoDe, navegar, navegable, etiquetaPeriodo, etiquetaBucket, PROMEDIO_LABEL } from '../../lib/periodos'
import { doblarEnOtros, colorSerie, colorIngresos } from '../../lib/chartTheme'
import {
  montoEnMonedaVista, descargarReporteCsv, textoReporteWhatsApp, linkWhatsAppReporte, imprimirReporte,
} from '../../lib/export/reportesExport'
import { graficoAPng, compartirPng } from '../../lib/compartirImagen'
import { descargarReportePdf } from '../../lib/reportePdf'

// Reportes 2.0 (nov 2026) — pensado para que el dueño lo lea del iPhone.
//
// TODOS los números salen de la RPC `reporte_resumen` (lib: fuente única, ver
// CLAUDE.md): acá no se suma ni se promedia nada. La pantalla, el CSV, el PDF,
// el push y el WhatsApp leen el mismo objeto.
//
// Orden de la pantalla, de arriba abajo: resultado neto grande, los cuatro
// KPIs, y después las secciones Ingresos, Egresos (la más trabajada, pedido
// explícito del dueño), Ocupación y Temporada.
//
// Moneda: el peso es la fuente de verdad. El switch a USD es de PRESENTACIÓN y
// divide por la cotización vigente; lo que entró literalmente en dólares va
// aparte en la sección Ingresos, al tipo de cambio guardado en cada pago.

const TIPO_ALQUILER_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día', sin_reserva: 'Sin reserva' }
const TIPO_COMPROBANTE_LABEL = { factura: 'Factura', recibo: 'Recibo', sin_comprobante: 'Sin comprobante' }

/** Flecha + color de la variación. null -> "sin datos para comparar". */
function Delta({ pct, className = '' }) {
  if (pct == null) {
    return <span className={`text-label text-ink-2 ${className}`}>Sin datos para comparar</span>
  }
  const sube = pct >= 0
  const Icono = sube ? TrendingUp : TrendingDown
  // Partir de casi cero infla la variación a números sin sentido: por encima
  // de +999% se muestra acotado — el dato útil ahí es "se disparó".
  const excede = Math.abs(pct) > 999
  return (
    <span
      title={excede ? formatPorcentaje(pct, 1) : undefined}
      className={`inline-flex items-center gap-1 tabular-nums ${sube ? 'text-success-ink' : 'text-danger'} ${className}`}
    >
      <Icono size={14} />
      {excede ? `${sube ? '>+' : '<−'}999%` : `${sube ? '+' : ''}${formatPorcentaje(pct, 1)}`}
    </span>
  )
}

/** Tile de KPI clickeable: lleva a su sección. */
function Kpi({ icono: Icono, label, valor, valorCompacto, sub, delta, onClick, tono = 'neutro' }) {
  const color = tono === 'positivo' ? 'text-success-ink' : tono === 'negativo' ? 'text-danger' : 'text-ink'
  return (
    <button
      type="button"
      onClick={onClick}
      data-card-compacta
      title={valor}
      className="card-surface p-3 xl:p-4 min-w-0 flex flex-col justify-center text-left hover:bg-row-hover transition-colors active:scale-[.98] min-h-[88px]"
    >
      <p className="flex items-center gap-2 text-label text-ink-2">
        <Icono size={14} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className={`text-card-title tabular-nums whitespace-nowrap mt-1 ${color}`}>
        <span className="xl:hidden">{valorCompacto ?? valor}</span>
        <span className="hidden xl:inline">{valor}</span>
      </p>
      {delta !== undefined ? <Delta pct={delta} className="text-label mt-1" /> : null}
      {sub && <p className="text-label text-ink-2 mt-1 truncate">{sub}</p>}
    </button>
  )
}

/** Card de sección con su título y, si se puede compartir, el botón. */
function Seccion({ id, titulo, children, compartible, onCompartir, className = '' }) {
  const ref = useRef(null)
  return (
    <section id={id} ref={ref} className={`card-surface card-pad space-y-4 scroll-mt-28 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-label text-ink">{titulo}</h2>
        {compartible && (
          <button
            type="button"
            onClick={() => onCompartir(ref.current, titulo)}
            className="no-print text-label shrink-0 h-11 md:h-9 px-3 rounded-full bg-surface text-ink-2 border border-line hover:text-ink transition-colors"
          >
            Compartir
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

const irA = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function Reportes() {
  const { perfil } = useAuth()
  const { temporadaActiva } = useData()
  const { toast } = useDialog()
  const tc = useTipoCambio()
  const oscuro = useOscuro()

  const [vista, setVista] = useState('mes')
  const [ancla, setAncla] = useState(hoyAR)
  const [moneda, setMoneda] = useState('ARS')
  const [rangoManual, setRangoManual] = useState(() => ({ desde: hoyAR(), hasta: hoyAR() }))

  const { desde, hasta } = useMemo(
    () => rangoDe(vista, ancla, { temporada: temporadaActiva, rango: rangoManual }),
    [vista, ancla, temporadaActiva, rangoManual],
  )
  const etiqueta = etiquetaPeriodo(vista, ancla, { temporada: temporadaActiva, rango: rangoManual })

  // Fuente única: una sola RPC, cacheada por período para que volver a uno ya
  // visto sea instantáneo (se repinta de la caché y se revalida por detrás).
  const params = useMemo(() => ({ p_desde: desde, p_hasta: hasta }), [desde, hasta])
  const { datos: resumen, cargando, revalidando, error } = useRpc('reporte_resumen', params)

  const cot = tc.valor
  const m = useCallback((v) => montoEnMonedaVista(Number(v ?? 0), moneda, cot), [moneda, cot])
  const mc = useCallback(
    (v) => (moneda === 'USD' ? montoEnMonedaVista(Number(v ?? 0), moneda, cot) : formatMontoCompacto(Number(v ?? 0))),
    [moneda, cot],
  )
  const faltaCotizacion = moneda === 'USD' && !cot

  const act = resumen?.actual || {}
  const ing = act.ingresos || {}
  const egr = act.egresos || {}
  const deltas = resumen?.deltas || {}
  const temp = resumen?.temporada || {}

  // Serie con la etiqueta ya resuelta: los gráficos no vuelven a formatear.
  const serie = useMemo(
    () => (resumen?.serie || []).map((r) => ({
      ...r,
      // `desde`, no `bucket`: con granularidad semanal o mensual el bucket
      // arranca antes del inicio del período (date_trunc) y la etiqueta
      // mostraría un día que no entra en el rango elegido.
      label: etiquetaBucket(r.desde || r.bucket, resumen.granularidad),
      ingresos: Number(r.ingresos || 0),
      egresos_f: Number(r.egresos_f || 0),
      egresos_sf: Number(r.egresos_sf || 0),
      neto: Number(r.neto || 0),
      ocupacion_pct: r.ocupacion_pct == null ? null : Number(r.ocupacion_pct),
    })),
    [resumen],
  )

  const donaMedios = useMemo(
    () => doblarEnOtros(
      (ing.por_medio || []).map((x) => ({
        ...x,
        nombre: `${MEDIO_PAGO_EMOJI[x.medio] || ''} ${MEDIO_PAGO_LABEL[x.medio] || x.medio}`.trim(),
      })),
      { oscuro },
    ),
    [ing.por_medio, oscuro],
  )

  const donaCategorias = useMemo(
    () => doblarEnOtros(
      (egr.por_categoria || []).map((c) => ({ ...c, nombre: c.nombre || c.categoria })),
      { oscuro },
    ),
    [egr.por_categoria, oscuro],
  )

  const barrasUnidad = useMemo(
    () => (ing.por_tipo_unidad || []).map((x, i) => ({
      nombre: x.tipo,
      etiqueta: `${unidadEmoji(x.tipo) || ''} ${x.tipo}`.trim(),
      valor: Number(x.total || 0),
      color: colorSerie(i, oscuro),
    })),
    [ing.por_tipo_unidad, oscuro],
  )

  const barrasAlquiler = useMemo(
    () => (ing.por_tipo_alquiler || []).map((x, i) => ({
      nombre: x.tipo,
      etiqueta: TIPO_ALQUILER_LABEL[x.tipo] || x.tipo,
      valor: Number(x.total || 0),
      color: colorSerie(i, oscuro),
    })),
    [ing.por_tipo_alquiler, oscuro],
  )

  const barrasComprobante = useMemo(
    () => (ing.por_comprobante || []).map((x, i) => ({
      nombre: x.tipo,
      etiqueta: TIPO_COMPROBANTE_LABEL[x.tipo] || x.tipo,
      valor: Number(x.total || 0),
      color: colorSerie(i, oscuro),
    })),
    [ing.por_comprobante, oscuro],
  )

  // ------------------------------------------------------------- exportar
  const opcionesExport = useMemo(
    () => ({ moneda, cotizacion: cot, vistaLabel: etiqueta, exportadoPorNombre: perfil?.nombre }),
    [moneda, cot, etiqueta, perfil?.nombre],
  )
  const textoWa = useMemo(
    () => (resumen ? textoReporteWhatsApp(resumen, opcionesExport) : ''),
    [resumen, opcionesExport],
  )
  const linkWa = linkWhatsAppReporte(perfil?.telefono, textoWa)

  const compartirSeccion = useCallback(async (nodo, titulo) => {
    try {
      const blob = await graficoAPng(nodo, { titulo: `${titulo} — Prius`, periodo: etiqueta, oscuro })
      const resultado = await compartirPng(blob, `prius-${titulo.toLowerCase().replace(/\s+/g, '-')}-${desde}.png`)
      if (resultado === 'descargado') toast('Imagen descargada', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No pudimos generar la imagen.', { tone: 'error' })
    }
  }, [etiqueta, oscuro, desde, toast])

  const acciones = useMemo(() => ({
    linkWa,
    onWhatsApp: () => {
      if (!linkWa) { toast('Cargá tu teléfono en Mi cuenta para poder enviarte el resumen.', { tone: 'error' }); return }
      window.open(linkWa, '_blank', 'noopener,noreferrer')
    },
    onCsv: () => {
      if (!resumen) return
      descargarReporteCsv(resumen, opcionesExport)
    },
    onImprimir: imprimirReporte,
    onPdf: async () => {
      try {
        await descargarReportePdf({ desde, hasta })
      } catch (err) {
        toast(err.message || 'No pudimos generar el PDF.', { tone: 'error' })
      }
    },
    onImagen: () => compartirSeccion(document.getElementById('reportes-hero'), 'Resultado neto'),
  }), [linkWa, resumen, opcionesExport, desde, hasta, toast, compartirSeccion])

  // --------------------------------------------------------------- swipe
  // Swipe horizontal para ir al período anterior/siguiente. Solo cuenta un
  // gesto claramente horizontal, así no pelea con el scroll vertical.
  const tocaRef = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    tocaRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const ini = tocaRef.current
    tocaRef.current = null
    if (!ini || !navegable(vista)) return
    const t = e.changedTouches[0]
    const dx = t.clientX - ini.x
    const dy = t.clientY - ini.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    setAncla((a) => navegar(vista, a, dx < 0 ? 1 : -1))
  }

  const controles = (
    <ReportesControles
      vista={vista}
      setVista={setVista}
      etiqueta={etiqueta}
      onAnterior={() => setAncla((a) => navegar(vista, a, -1))}
      onSiguiente={() => setAncla((a) => navegar(vista, a, 1))}
      moneda={moneda}
      setMoneda={setMoneda}
      rango={rangoManual}
      setRango={setRangoManual}
      acciones={acciones}
    />
  )

  if (cargando) {
    return (
      <div className="space-y-grid">
        <ToolbarSticky>{controles}</ToolbarSticky>
        <Skeleton className="h-36" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-grid">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="space-y-grid animate-premium-fade" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <ToolbarSticky>{controles}</ToolbarSticky>

      {error && (
        <div className="p-3 bg-danger-soft border border-danger/30 rounded-inner text-label text-danger">
          No pudimos traer los números del período. {error}
        </div>
      )}

      {faltaCotizacion && (
        <div className="no-print p-3 bg-gold-100 border border-gold-300 rounded-inner text-label text-ink">
          No hay cotización del dólar disponible. Los importes en USD se muestran como “—”.
        </div>
      )}

      {/* Encabezado solo para la impresión A4 de la pantalla. */}
      <div className="hidden print:block mb-4">
        <h1 className="text-card-title">Prius Playa Grande — Reporte</h1>
        <p className="text-label">
          {formatFecha(desde)} al {formatFecha(hasta)} · Moneda: {moneda}
          {moneda === 'USD' && cot ? ` (cotización ${formatMonto(cot)})` : ''}
        </p>
      </div>

      {/* Hero: el resultado neto, grande. */}
      <div id="reportes-hero" className="card-surface p-7 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-label text-ink-2 flex items-center gap-2">
            Resultado neto · {etiqueta}
            {revalidando && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" aria-label="Actualizando" />}
          </p>
          <p
            title={m(act.neto)}
            className={`text-kpi tabular-nums whitespace-nowrap mt-1 ${Number(act.neto || 0) >= 0 ? 'text-ink' : 'text-danger'}`}
          >
            {m(act.neto)}
          </p>
          <Delta pct={deltas.neto} className="text-body mt-2" />
        </div>
        <div className="w-full sm:w-56 shrink-0">
          <Sparkline datos={serie} clave="neto" />
          <p className="text-label text-ink-2 text-center">
            {serie.length} {resumen?.granularidad === 'mes' ? 'meses' : resumen?.granularidad === 'semana' ? 'semanas' : 'días'}
          </p>
        </div>
      </div>

      {/* Cuatro KPIs. Cada uno lleva a su sección. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-grid">
        <Kpi
          icono={Wallet} label="Ingresos" tono="positivo"
          valor={m(ing.total)} valorCompacto={mc(ing.total)} delta={deltas.ingresos}
          sub={`${Number(ing.cantidad || 0)} cobros`}
          onClick={() => irA('reportes-ingresos')}
        />
        <Kpi
          icono={Receipt} label="Egresos" tono="negativo"
          valor={m(egr.total)} valorCompacto={mc(egr.total)} delta={deltas.egresos}
          sub={egr.pct_sf == null ? 'Sin egresos' : `${formatPorcentaje(egr.pct_sf, 1)} sin factura`}
          onClick={() => irA('reportes-egresos')}
        />
        <Kpi
          icono={Percent} label="Ocupación"
          valor={act.ocupacion?.promedio_pct == null ? '—' : formatPorcentaje(act.ocupacion.promedio_pct, 1)}
          delta={deltas.ocupacion}
          sub="Promedio del período"
          onClick={() => irA('reportes-ocupacion')}
        />
        <Kpi
          icono={Hourglass} label="Por cobrar"
          valor={m(temp.por_cobrar)} valorCompacto={mc(temp.por_cobrar)}
          sub={temp.nombre ? `Temporada ${temp.nombre}` : 'Temporada'}
          onClick={() => irA('reportes-temporada')}
        />
      </div>

      {/* ------------------------------------------------------- Ingresos */}
      <Seccion id="reportes-ingresos" titulo="Ingresos" compartible onCompartir={compartirSeccion}>
        <BarrasEnElTiempo datos={serie} clave="ingresos" nombre="Ingresos" descripcion={`Ingresos por período, ${etiqueta}`} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-grid">
          <div className="card-inner">
            <p className="text-label text-ink-2 mb-3">Por medio de pago</p>
            <Dona
              datos={donaMedios}
              total={Number(ing.total || 0)}
              descripcion="Ingresos por medio de pago"
              etiquetaCentro={{ label: 'Cobros', valor: String(Number(ing.cantidad || 0)) }}
            />
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2 mb-3">Por tipo de comprobante</p>
            <BarrasHorizontales datos={barrasComprobante} descripcion="Ingresos por tipo de comprobante" />
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2 mb-3">Por tipo de unidad</p>
            <BarrasHorizontales datos={barrasUnidad} descripcion="Ingresos por tipo de unidad" />
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2 mb-3">Por tipo de alquiler</p>
            <BarrasHorizontales datos={barrasAlquiler} descripcion="Ingresos por tipo de alquiler" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-inner">
            <p className="text-label text-ink-2">Ticket promedio</p>
            <p className="text-body text-ink tabular-nums mt-1">{m(act.ticket_promedio)}</p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">{PROMEDIO_LABEL[vista] || 'Promedio diario'}</p>
            <p className="text-body text-ink tabular-nums mt-1">
              {m(Number(ing.total || 0) / Math.max(Number(act.dias || 1), 1))}
            </p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">Cierre Z del período</p>
            <p className="text-body text-ink tabular-nums mt-1">{m(act.z?.total)}</p>
            <p className="text-label text-ink-2">{Number(act.z?.cantidad || 0)} Z cargadas</p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">Cajas cerradas</p>
            <p className="text-body text-ink tabular-nums mt-1">
              {Number(act.cajas?.cerradas || 0)} de {Number(act.cajas?.total || 0)}
            </p>
            {Number(act.cajas?.arqueo_pendiente || 0) > 0 && (
              <p className="text-label text-ink-2">{act.cajas.arqueo_pendiente} con arqueo pendiente</p>
            )}
          </div>
        </div>

        {Number(ing.usd_recibidos || 0) > 0 && (
          <p className="text-label text-ink-2">
            Cobrado en dólares: {formatMonto(Number(ing.usd_recibidos))} USD, equivalentes a{' '}
            {formatMonto(Number(ing.usd_en_pesos))} al tipo de cambio de cada pago.
          </p>
        )}
      </Seccion>

      {/* -------------------------------------------------------- Egresos */}
      <Seccion id="reportes-egresos" titulo="Egresos" compartible onCompartir={compartirSeccion}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-inner">
            <p className="text-label text-ink-2 flex items-center gap-1.5"><BadgeFactura tipo="F" /> Con factura</p>
            <p className="text-body text-ink tabular-nums mt-1">{m(egr.total_f)}</p>
            <p className="text-label text-ink-2">{Number(egr.cantidad_f ?? 0) || ''}</p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2 flex items-center gap-1.5"><BadgeFactura tipo="SF" /> Sin factura</p>
            <p className="text-body text-ink tabular-nums mt-1">{m(egr.total_sf)}</p>
            <p className="text-label text-ink-2">
              {egr.pct_sf == null ? 'Sin egresos' : `${formatPorcentaje(egr.pct_sf, 1)} del total`}
            </p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">Egresos / ingresos</p>
            <p className="text-body text-ink tabular-nums mt-1">
              {egr.ratio_sobre_ingresos == null ? '—' : formatPorcentaje(egr.ratio_sobre_ingresos, 1)}
            </p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">Gasto promedio diario</p>
            <p className="text-body text-ink tabular-nums mt-1">{m(egr.promedio_diario)}</p>
          </div>
        </div>

        <div>
          <p className="text-label text-ink-2 mb-2">Con factura vs sin factura, en el tiempo</p>
          <BarrasApiladasFSF datos={serie} descripcion={`Egresos con y sin factura, ${etiqueta}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-grid">
          <div className="card-inner">
            <p className="text-label text-ink-2 mb-3">Por categoría</p>
            <Dona
              datos={donaCategorias}
              total={Number(egr.total || 0)}
              descripcion="Egresos por categoría"
              etiquetaCentro={{ label: 'Sin factura', valor: egr.pct_sf == null ? '—' : formatPorcentaje(egr.pct_sf, 0) }}
            />
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2 mb-3">Principales proveedores</p>
            {(egr.top_proveedores || []).length === 0 ? (
              <p className="text-label text-ink-2">Todavía no hay gastos con proveedor cargado.</p>
            ) : (
              <BarrasHorizontales
                datos={(egr.top_proveedores || []).map((p, i) => ({
                  nombre: p.proveedor, valor: Number(p.total || 0), color: colorSerie(i, oscuro),
                }))}
                descripcion="Principales proveedores por monto"
              />
            )}
          </div>
        </div>

        <div>
          <p className="text-label text-ink-2 mb-2">Los gastos más grandes del período</p>
          {(egr.mas_grandes || []).length === 0 ? (
            <p className="text-label text-ink-2">Sin egresos en el período.</p>
          ) : (
            <ul className="divide-y divide-line">
              {egr.mas_grandes.map((g) => (
                <li key={g.gasto_id} className="py-2 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <BadgeFactura tipo={g.tipo_comprobante} className="mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-body text-ink truncate" title={g.concepto}>{g.concepto}</p>
                      <p className="text-label text-ink-2 truncate">
                        {formatFecha(g.fecha)} · {g.categoria}
                        {g.proveedor ? ` · ${g.proveedor}` : ''}
                        {g.tipo_comprobante === 'F' && (g.letra_factura || g.numero_factura)
                          ? ` · Factura ${[g.letra_factura, g.numero_factura].filter(Boolean).join(' ')}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-body font-semibold text-danger tabular-nums shrink-0">{m(g.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Seccion>

      {/* ------------------------------------------------------ Ocupación */}
      <Seccion id="reportes-ocupacion" titulo="Ocupación" compartible onCompartir={compartirSeccion}>
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-grid items-center">
          <div className="card-inner">
            <AnilloOcupacion
              pct={act.ocupacion?.promedio_pct}
              label="Ocupación promedio del período"
              sub="promedio"
            />
            {act.ocupacion?.dia_pico?.fecha && (
              <p className="text-label text-ink-2 text-center mt-2">
                Día pico: {formatFecha(act.ocupacion.dia_pico.fecha)} ·{' '}
                {act.ocupacion.dia_pico.ocupadas} de {act.ocupacion.dia_pico.total}
                {act.ocupacion.dia_pico.pct == null ? '' : ` (${formatPorcentaje(act.ocupacion.dia_pico.pct, 1)})`}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <LineaOcupacion datos={serie} descripcion={`Ocupación en el tiempo, ${etiqueta}`} />
          </div>
        </div>
        <OcupacionPorTipo fecha={hasta} m={m} />
      </Seccion>

      {/* ------------------------------------------------------ Temporada */}
      <Seccion id="reportes-temporada" titulo={`Temporada ${temp.nombre || ''}`.trim()}>
        <ProgresoTemporada
          comprometido={Number(temp.comprometido || 0)}
          cobrado={Number(temp.cobrado || 0)}
          porCobrar={Number(temp.por_cobrar || 0)}
          pct={temp.pct_cobrado == null ? null : Number(temp.pct_cobrado)}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card-inner">
            <p className="text-label text-ink-2">Facturación comprometida</p>
            <p className="text-body text-ink tabular-nums mt-1">{m(temp.comprometido)}</p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">Reservas</p>
            <p className="text-body text-ink tabular-nums mt-1">{Number(temp.reservas || 0)}</p>
          </div>
          <div className="card-inner">
            <p className="text-label text-ink-2">Bonificadas</p>
            <p className="text-body text-ink tabular-nums mt-1">{Number(temp.bonificadas || 0)}</p>
          </div>
        </div>
        <p className="text-label text-ink-2 flex items-start gap-2">
          <CalendarRange size={14} className="shrink-0 mt-0.5" />
          Lo cobrado incluye los pagos anteriores al 1/10/2026, que no cuentan como flujo de caja
          pero sí como plata ya cobrada de la temporada.
        </p>
      </Seccion>

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

/** Ocupación por tipo del último día del período (anillo total + por tipo). */
function OcupacionPorTipo({ fecha }) {
  const oscuro = useOscuro()
  const params = useMemo(() => ({ p_fecha: fecha }), [fecha])
  const { datos } = useRpc('reporte_ocupacion_dia', params)
  const porTipo = datos?.por_tipo || []
  if (!porTipo.length) return null
  return (
    <div>
      <p className="text-label text-ink-2 mb-3">Por tipo de unidad, al {formatFecha(fecha)}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {porTipo.map((t, i) => (
          <div key={t.tipo} className="card-inner">
            <p className="text-label text-ink-2 truncate">
              {unidadEmoji(t.tipo) || ''} {t.tipo}
            </p>
            <p className="text-body text-ink tabular-nums mt-1">
              {t.ocupadas} de {t.total}
            </p>
            <span className="block w-full h-2 mt-1.5 rounded-full bg-surface overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{ width: `${t.pct ?? 0}%`, background: colorIngresos(oscuro) }}
              />
            </span>
            <p className="text-label text-ink-2 mt-1">
              {t.pct == null ? '—' : formatPorcentaje(t.pct, 1)}
              {t.bonificadas > 0 ? ` · ${t.bonificadas} bonificadas` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

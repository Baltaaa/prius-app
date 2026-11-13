import { crearDocumentoCsv } from './csvBuilder'
import { descargarCsv, nombreArchivoCsv } from './descargarCsv'
// Exportaciones: siempre con los montos reales, aunque el modo privacidad esté activo.
import { formatMonto, formatMontoUSD, formatMontoReal, formatMontoUSDReal, formatPorcentaje, formatFecha } from '../format'
import { formatMontoCsv, etiqueta } from './formatos'
import { MEDIO_PAGO_LABEL } from '../pagos'
import { etiquetaBucket } from '../periodos'

// Exportación de Reportes (nov 2026): CSV, texto para WhatsApp y PDF.
//
// Todo sale del MISMO objeto que devuelve `reporte_resumen` y que pinta la
// pantalla: el CSV, el WhatsApp, el PDF y los gráficos no pueden mostrar
// números distintos. Acá no se suma nada.
//
// El CSV sigue la estructura y la estética del CSV de cierre de caja
// (lib/export/cajaCsv.ts): mismo builder, mismas secciones con título,
// columnas y fila de total, mismo separador y mismo BOM.

/** Para MOSTRAR en pantalla: respeta el modo privacidad ("$ ••••••"). */
export function montoEnMonedaVista(pesos, moneda, cotizacion) {
  if (moneda === 'USD') {
    if (!cotizacion || cotizacion <= 0) return '—'
    return formatMontoUSD(pesos / cotizacion)
  }
  return formatMonto(pesos)
}

/** Para exportar e imprimir (CSV, WhatsApp, A4): siempre el monto real. */
export function montoEnMoneda(pesos, moneda, cotizacion) {
  if (moneda === 'USD') {
    if (!cotizacion || cotizacion <= 0) return '—'
    return formatMontoUSDReal(pesos / cotizacion)
  }
  return formatMontoReal(pesos)
}

const num = (v) => Number(v ?? 0)
const pct = (v) => (v == null ? 'sin datos' : formatPorcentaje(Number(v), 1))

// ---------------------------------------------------------------------- CSV

export function construirReporteCsv(resumen, { moneda, cotizacion, vistaLabel, exportadoPorNombre }) {
  const act = resumen.actual || {}
  const ant = resumen.anterior || {}
  const ing = act.ingresos || {}
  const egr = act.egresos || {}
  const temp = resumen.temporada || {}
  const deltas = resumen.deltas || {}
  // En el CSV los montos van como entero plano (sin "$" ni miles) para que
  // Excel los trate como número — igual que en el CSV de cierre de caja.
  const m = (v) => (moneda === 'USD' && cotizacion ? formatMontoCsv(num(v) / cotizacion) : formatMontoCsv(num(v)))
  const ahora = new Date()

  const metadatos = [
    ['Período', vistaLabel],
    ['Desde', formatFecha(resumen.periodo?.desde)],
    ['Hasta', formatFecha(resumen.periodo?.hasta)],
    ['Período anterior', `${formatFecha(resumen.periodo_anterior?.desde)} al ${formatFecha(resumen.periodo_anterior?.hasta)}`],
    ['Moneda', moneda],
  ]
  if (moneda === 'USD') metadatos.push(['Cotización usada', cotizacion ? formatMontoReal(cotizacion) : '—'])
  metadatos.push(
    ['Exportado el', formatFecha(ahora)],
    ['Exportado por', exportadoPorNombre || '—'],
  )

  const secciones = [
    {
      titulo: 'Resumen',
      columnas: ['Concepto', `Monto (${moneda})`, 'Período anterior', 'Variación'],
      filas: [
        ['Ingresos', m(ing.total), m(ant.ingresos?.total), deltas.ingresos == null ? '' : formatPorcentaje(deltas.ingresos, 1)],
        ['Egresos', m(egr.total), m(ant.egresos?.total), deltas.egresos == null ? '' : formatPorcentaje(deltas.egresos, 1)],
        ['Egresos con factura (F)', m(egr.total_f), m(ant.egresos?.total_f), deltas.egresos_f == null ? '' : formatPorcentaje(deltas.egresos_f, 1)],
        ['Egresos sin factura (SF)', m(egr.total_sf), m(ant.egresos?.total_sf), deltas.egresos_sf == null ? '' : formatPorcentaje(deltas.egresos_sf, 1)],
        ['% sin factura', egr.pct_sf == null ? '' : String(egr.pct_sf), '', ''],
        ['Resultado neto', m(act.neto), m(ant.neto), deltas.neto == null ? '' : formatPorcentaje(deltas.neto, 1)],
        ['Ticket promedio', m(act.ticket_promedio), m(ant.ticket_promedio), deltas.ticket_promedio == null ? '' : formatPorcentaje(deltas.ticket_promedio, 1)],
        ['Cierre Z del período', m(act.z?.total), m(ant.z?.total), ''],
        ['Ocupación promedio', act.ocupacion?.promedio_pct == null ? '' : String(act.ocupacion.promedio_pct), ant.ocupacion?.promedio_pct == null ? '' : String(ant.ocupacion.promedio_pct), deltas.ocupacion == null ? '' : formatPorcentaje(deltas.ocupacion, 1)],
        ['Cobros', String(num(ing.cantidad)), String(num(ant.ingresos?.cantidad)), ''],
        ['Cajas cerradas', String(num(act.cajas?.cerradas)), String(num(ant.cajas?.cerradas)), ''],
      ],
    },
    {
      titulo: 'Evolución',
      columnas: ['Período', `Ingresos (${moneda})`, `Egresos F (${moneda})`, `Egresos SF (${moneda})`, `Neto (${moneda})`, 'Ocupación %'],
      filas: (resumen.serie || []).map((r) => [
        etiquetaBucket(r.bucket, resumen.granularidad),
        m(r.ingresos), m(r.egresos_f), m(r.egresos_sf), m(r.neto),
        r.ocupacion_pct == null ? '' : String(r.ocupacion_pct),
      ]),
      filaTotal: ['TOTAL', m(ing.total), m(egr.total_f), m(egr.total_sf), m(act.neto), act.ocupacion?.promedio_pct == null ? '' : String(act.ocupacion.promedio_pct)],
    },
    {
      titulo: 'Ingresos por medio de pago',
      columnas: ['Medio', `Monto (${moneda})`, 'Cobros'],
      filas: (ing.por_medio || []).map((x) => [MEDIO_PAGO_LABEL[x.medio] || x.medio, m(x.total), String(num(x.cantidad))]),
      filaTotal: ['Total', m(ing.total), String(num(ing.cantidad))],
    },
    {
      titulo: 'Ingresos por tipo de comprobante',
      columnas: ['Tipo', `Monto (${moneda})`, 'Cobros'],
      filas: (ing.por_comprobante || []).map((x) => [x.tipo, m(x.total), String(num(x.cantidad))]),
    },
    {
      titulo: 'Ingresos por tipo de unidad',
      columnas: ['Tipo de unidad', `Monto (${moneda})`, 'Cobros'],
      filas: (ing.por_tipo_unidad || []).map((x) => [x.tipo, m(x.total), String(num(x.cantidad))]),
    },
    {
      titulo: 'Ingresos por tipo de alquiler',
      columnas: ['Tipo de alquiler', `Monto (${moneda})`, 'Cobros'],
      filas: (ing.por_tipo_alquiler || []).map((x) => [x.tipo, m(x.total), String(num(x.cantidad))]),
    },
    {
      titulo: 'Egresos por categoría',
      columnas: ['Categoría', 'Cantidad', `Con factura (F) (${moneda})`, `Sin factura (SF) (${moneda})`, `Total (${moneda})`, 'Participación %'],
      filas: (egr.por_categoria || []).map((c) => [
        c.nombre || etiqueta('categoria_gasto', c.categoria),
        String(num(c.cantidad)), m(c.total_f), m(c.total_sf), m(c.total),
        c.pct == null ? '' : String(c.pct),
      ]),
      filaTotal: ['Total', String(num(egr.cantidad)), m(egr.total_f), m(egr.total_sf), m(egr.total), ''],
    },
    {
      titulo: 'Egresos detallados (los más grandes del período)',
      columnas: ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Proveedor', 'Letra', 'N° de factura', `Monto (${moneda})`],
      filas: (egr.mas_grandes || []).map((g) => [
        formatFecha(g.fecha), g.tipo_comprobante || '', g.concepto || '', g.categoria || '',
        g.proveedor || '', g.letra_factura || '', g.numero_factura || '', m(g.monto),
      ]),
    },
    {
      titulo: 'Principales proveedores',
      columnas: ['Proveedor', 'Gastos', `Monto (${moneda})`],
      filas: (egr.top_proveedores || []).map((p) => [p.proveedor, String(num(p.cantidad)), m(p.total)]),
    },
    {
      titulo: 'Temporada',
      columnas: ['Concepto', `Monto (${moneda})`],
      filas: [
        ['Temporada', temp.nombre || '—'],
        ['Facturación comprometida', m(temp.comprometido)],
        ['Cobrado', m(temp.cobrado)],
        ['Por cobrar', m(temp.por_cobrar)],
        ['% cobrado', temp.pct_cobrado == null ? '' : String(temp.pct_cobrado)],
        ['Reservas', String(num(temp.reservas))],
        ['Bonificadas', String(num(temp.bonificadas))],
      ],
    },
  ]

  return crearDocumentoCsv({ titulo: 'Reporte', metadatos, secciones })
}

export function descargarReporteCsv(resumen, opciones) {
  const csv = construirReporteCsv(resumen, opciones)
  descargarCsv(csv, nombreArchivoCsv('reporte', resumen.periodo?.desde, resumen.periodo?.hasta))
}

// ----------------------------------------------------------------- WhatsApp

/**
 * Resumen del período en texto, listo para pegar en WhatsApp. Sin servicios
 * externos: abre wa.me con el texto prearmado.
 */
export function textoReporteWhatsApp(resumen, { moneda, cotizacion, vistaLabel }) {
  const act = resumen.actual || {}
  const ing = act.ingresos || {}
  const egr = act.egresos || {}
  const temp = resumen.temporada || {}
  const d = resumen.deltas || {}
  const m = (v) => montoEnMoneda(v, moneda, cotizacion)
  const variacion = (v) => (v == null ? '' : ` (${v >= 0 ? '+' : ''}${formatPorcentaje(v, 1)} vs período anterior)`)

  return [
    `*Prius Playa Grande — ${vistaLabel}*`,
    `${formatFecha(resumen.periodo?.desde)} al ${formatFecha(resumen.periodo?.hasta)}`,
    '',
    `💰 Ingresos: ${m(ing.total)}${variacion(d.ingresos)}`,
    `💸 Egresos: ${m(egr.total)}`,
    `   · Con factura (F): ${m(egr.total_f)}`,
    `   · Sin factura (SF): ${m(egr.total_sf)}${egr.pct_sf == null ? '' : ` — ${formatPorcentaje(egr.pct_sf, 1)} del total`}`,
    `📊 Resultado neto: ${m(act.neto)}${variacion(d.neto)}`,
    `🏖️ Ocupación promedio: ${pct(act.ocupacion?.promedio_pct)}`,
    act.z?.cantidad ? `🧾 Cierre Z: ${m(act.z.total)} (${act.z.cantidad} Z)` : null,
    '',
    `*Temporada ${temp.nombre || ''}*`.trim(),
    `Comprometido: ${m(temp.comprometido)}`,
    `Cobrado: ${m(temp.cobrado)}${temp.pct_cobrado == null ? '' : ` (${formatPorcentaje(temp.pct_cobrado, 1)})`}`,
    `Por cobrar: ${m(temp.por_cobrar)}`,
  ].filter(Boolean).join('\n')
}

export function linkWhatsAppReporte(telefono, texto) {
  if (!telefono) return null
  const soloDigitos = String(telefono).replace(/\D/g, '')
  if (!soloDigitos) return null
  return `https://wa.me/${soloDigitos}?text=${encodeURIComponent(texto)}`
}

/** Impresión A4 de la pantalla (el PDF "oficial" lo genera la Edge Function). */
export function imprimirReporte() {
  window.print()
}

import { crearDocumentoCsv } from './csvBuilder'
import { descargarCsv, nombreArchivoCsv } from './descargarCsv'
import { formatPesos, formatDolares, formatPorcentaje } from '../format'
import { MEDIO_PAGO_LABEL } from '../pagos'

// Exportación de Reportes (31/10/2026): CSV, texto para WhatsApp e impresión
// A4 / PDF. Los tres consumen la MISMA serie ya calculada por lib/reportes.js,
// así que nunca pueden mostrar números distintos a los de la pantalla.
//
// El PDF sale por la impresión del navegador ("Guardar como PDF" en el
// diálogo), igual que la hoja A4 de Caja y del Plano — sin sumar una
// dependencia de PDF al bundle.

/** Formatea un importe en la moneda elegida para mostrar. */
export function montoEnMoneda(pesos, moneda, cotizacion) {
  if (moneda === 'USD') {
    if (!cotizacion || cotizacion <= 0) return '—'
    return formatDolares(pesos / cotizacion)
  }
  return formatPesos(pesos)
}

export function descargarReporteCsv({ serie, totales, proyeccion, moneda, cotizacion, periodoLabel, desde, hasta, porMedio = [] }) {
  const m = (v) => montoEnMoneda(v, moneda, cotizacion)
  const metadatos = [
    ['Período', periodoLabel],
    ['Desde', desde || '—'],
    ['Hasta', hasta || '—'],
    ['Moneda', moneda],
  ]
  if (moneda === 'USD') metadatos.push(['Cotización usada', cotizacion ? formatPesos(cotizacion) : '—'])

  const secciones = [
    {
      titulo: 'Evolución',
      columnas: ['Período', `Ingresos (${moneda})`, `Egresos (${moneda})`, `Neto (${moneda})`, 'Cobros', 'Var. vs anterior'],
      filas: serie.map((r) => [
        r.label, m(r.ingresos), m(r.egresos), m(r.neto), r.cantidadPagos,
        r.variacionIngresos == null ? '' : formatPorcentaje(r.variacionIngresos, 1),
      ]),
      filaTotal: ['TOTAL', m(totales.ingresos), m(totales.egresos), m(totales.neto), totales.cantidadPagos, ''],
    },
  ]

  if (porMedio.length > 0) {
    secciones.push({
      titulo: 'Por medio de pago',
      columnas: ['Medio', `Monto (${moneda})`, 'Participación'],
      filas: porMedio.map((x) => [MEDIO_PAGO_LABEL[x.medio] || x.medio, m(x.monto), formatPorcentaje(x.pct, 1)]),
    })
  }

  if (proyeccion) {
    secciones.push({
      titulo: `Proyección ${proyeccion.label}`,
      columnas: ['Concepto', `Valor (${moneda})`],
      filas: [
        ['Transcurrido', formatPorcentaje(proyeccion.pctTranscurrido, 0)],
        ['Ingresos hasta ahora', m(proyeccion.ingresosHastaAhora)],
        ['Ingresos proyectados', m(proyeccion.ingresosProyectados)],
        ['Neto proyectado', m(proyeccion.netoProyectado)],
      ],
    })
  }

  const csv = crearDocumentoCsv({ titulo: `Reportes — ${periodoLabel}`, metadatos, secciones })
  descargarCsv(csv, nombreArchivoCsv('reportes', desde || hasta || '', `${periodoLabel}-${moneda}`))
}

/**
 * Resumen en texto plano para WhatsApp. Corto a propósito: el dueño lo lee en
 * el celular, no quiere una planilla. Los últimos 6 períodos + totales.
 */
export function textoReporteWhatsApp({ serie, totales, proyeccion, moneda, cotizacion, periodoLabel, desde, hasta }) {
  const m = (v) => montoEnMoneda(v, moneda, cotizacion)
  const lineas = []
  lineas.push(`*Prius Playa Grande — Reporte ${periodoLabel}*`)
  if (desde || hasta) lineas.push(`${desde || '…'} a ${hasta || '…'}`)
  lineas.push(`Moneda: ${moneda}${moneda === 'USD' && cotizacion ? ` (cotización ${formatPesos(cotizacion)})` : ''}`)
  lineas.push('')
  lineas.push(`*Ingresos:* ${m(totales.ingresos)}`)
  lineas.push(`*Egresos:* ${m(totales.egresos)}`)
  lineas.push(`*Neto:* ${m(totales.neto)}`)
  lineas.push(`Margen: ${formatPorcentaje(totales.margen, 1)} · Cobros: ${totales.cantidadPagos}`)
  lineas.push(`Ticket promedio: ${m(totales.ticketPromedio)}`)

  if (proyeccion) {
    lineas.push('')
    lineas.push(`_Proyección ${proyeccion.label}_ (${formatPorcentaje(proyeccion.pctTranscurrido, 0)} transcurrido)`)
    lineas.push(`Ingresos proyectados: ${m(proyeccion.ingresosProyectados)}`)
    lineas.push(`Neto proyectado: ${m(proyeccion.netoProyectado)}`)
  }

  const ultimos = serie.slice(-6)
  if (ultimos.length > 0) {
    lineas.push('')
    lineas.push('*Detalle*')
    for (const r of ultimos) {
      const varia = r.variacionIngresos == null ? '' : ` (${r.variacionIngresos >= 0 ? '+' : ''}${formatPorcentaje(r.variacionIngresos, 0)})`
      lineas.push(`• ${r.label}: ${m(r.ingresos)}${varia}`)
    }
  }
  return lineas.join('\n')
}

/**
 * Link de WhatsApp al número del usuario logueado. Devuelve null si el perfil
 * no tiene teléfono cargado — el botón queda deshabilitado en ese caso.
 */
export function linkWhatsAppReporte(telefonoE164, texto) {
  if (!telefonoE164) return null
  return `https://wa.me/${String(telefonoE164).replace('+', '')}?text=${encodeURIComponent(texto)}`
}

/** Dispara la impresión del navegador (A4 / "Guardar como PDF"). */
export function imprimirReporte() {
  window.print()
}

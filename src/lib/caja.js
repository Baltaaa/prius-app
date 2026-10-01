// Helpers compartidos del módulo Caja — CSV/labels, un solo lugar para que
// pantalla, impresión A4 y CSV usen exactamente los mismos textos y el
// mismo origen de datos (resumen_caja jsonb). Fechas y montos salen siempre
// de lib/format.js (única fuente de verdad) — la única excepción de formato
// es la propia columna "monto" del CSV, que va como entero plano para que
// Excel pueda sumarla (decisión única de formato de pesos de la app).
import { formatFecha, formatFechaHora, formatPesosCSV } from './format'

export { formatHora } from './format'

export const CATEGORIA_GASTO_LABEL = {
  proveedores: 'Proveedores',
  sueldos_adelantos: 'Sueldos / Adelantos',
  mantenimiento: 'Mantenimiento',
  limpieza: 'Limpieza',
  insumos: 'Insumos',
  servicios: 'Servicios',
  retiro_dueno: 'Retiro del dueño',
  otros: 'Otros',
}

const csvEscape = (val) => {
  const s = String(val ?? '')
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const csvRow = (cols) => cols.map(csvEscape).join(';')

// Un único CSV con columna "seccion" — pantalla, impresión y CSV parten
// siempre del mismo resumen_caja(caja_id), así que los totales nunca pueden
// desalinearse entre sí.
export function construirCajaCSV(resumen) {
  const filas = []
  const header = ['seccion', 'fecha_hora', 'comprobante', 'cliente_proveedor', 'unidad', 'concepto', 'medio_pago', 'monto', 'estado']
  filas.push(csvRow(header))

  const { cabecera, totales, por_medio, arqueo, z, facturas, recibos, sin_comprobante, gastos, anulados } = resumen

  filas.push(csvRow(['cabecera', formatFecha(cabecera.fecha), '', '', '', 'Estado', '', '', cabecera.estado]))
  filas.push(csvRow(['totales', '', '', '', '', 'Ingresos', '', formatPesosCSV(totales.ingresos), '']))
  filas.push(csvRow(['totales', '', '', '', '', 'Egresos', '', formatPesosCSV(-totales.egresos), '']))
  filas.push(csvRow(['totales', '', '', '', '', 'Neto', '', formatPesosCSV(totales.neto), '']))

  for (const m of por_medio || []) {
    filas.push(csvRow(['medio_pago', '', '', '', '', m.medio, m.medio, formatPesosCSV(m.neto), '']))
  }

  filas.push(csvRow(['arqueo', '', '', '', '', 'Inicial', '', formatPesosCSV(arqueo.inicial), '']))
  filas.push(csvRow(['arqueo', '', '', '', '', 'Esperado', '', formatPesosCSV(arqueo.esperado), '']))
  filas.push(csvRow(['arqueo', '', '', '', '', 'Contado', '', formatPesosCSV(arqueo.contado), '']))
  filas.push(csvRow(['arqueo', '', '', '', '', 'Diferencia', '', formatPesosCSV(arqueo.diferencia), '']))

  if (z?.numero) {
    filas.push(csvRow(['z', formatFecha(z.fecha), z.numero, '', '', 'Total Z', '', formatPesosCSV(z.total), '']))
    filas.push(csvRow(['z', '', '', '', '', 'Cantidad de comprobantes', '', z.cantidad_comprobantes ?? '', '']))
  }

  for (const f of facturas || []) {
    filas.push(csvRow(['factura', formatFecha(f.fecha), f.etiqueta, '', '', f.tipo, '', formatPesosCSV(f.monto_total), f.estado]))
  }
  for (const r of recibos || []) {
    filas.push(csvRow(['recibo', formatFecha(r.fecha), r.etiqueta, '', '', r.tipo, '', formatPesosCSV(r.monto_total), r.estado]))
  }
  for (const p of sin_comprobante || []) {
    filas.push(csvRow(['sin_comprobante', formatFechaHora(p.fecha_hora), 'Sin comprobante', p.cliente || '', '', p.concepto || '', p.medio, formatPesosCSV(p.monto), '']))
  }
  for (const g of gastos?.detalle || []) {
    filas.push(csvRow(['gasto', formatFechaHora(g.fecha_hora), '', g.proveedor || '', '', g.concepto, g.medio_pago, formatPesosCSV(-g.monto), g.estado]))
  }
  for (const p of anulados?.pagos || []) {
    filas.push(csvRow(['anulado', formatFechaHora(p.anulado_at), '', '', '', `Pago anulado — ${p.motivo}`, p.medio, formatPesosCSV(p.monto), 'anulado']))
  }
  for (const g of anulados?.gastos || []) {
    filas.push(csvRow(['anulado', formatFechaHora(g.anulado_at), '', '', '', `Gasto anulado — ${g.motivo}`, '', formatPesosCSV(-g.monto), 'anulado']))
  }

  return filas.join('\r\n')
}

export function descargarCajaCSV(resumen) {
  const csv = construirCajaCSV(resumen)
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `caja-prius-${resumen.cabecera.fecha}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

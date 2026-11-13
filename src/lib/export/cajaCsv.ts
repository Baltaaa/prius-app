// CSV del cierre de caja (oct 2026, Tarea 3) — reemplaza por completo al
// viejo `construirCajaCSV` de `lib/caja.js` (borrado, no "mejorado"). Única
// fuente de datos: `resumen_caja(caja_id)`, la misma que ya alimentan
// ResumenCaja.jsx y CajaImpresion.jsx — así pantalla/impresión/CSV nunca
// pueden desalinearse entre sí.
import { crearDocumentoCsv, type Seccion } from './csvBuilder'
import { descargarCsv, nombreArchivoCsv } from './descargarCsv'
import { formatFechaCsv, formatHoraCsv, formatMontoCsv, etiqueta, etiquetaComprobante, unidadNotacionCsv } from './formatos'
import { totalDiaResumen } from '../totalDiaCaja'

interface MetaExport {
  exportadoPorNombre: string
}

const RESULTADO_ARQUEO = (diferencia: number): string => {
  if (diferencia > 0) return 'Sobrante'
  if (diferencia < 0) return 'Faltante'
  return 'Sin diferencia'
}

/** Neto = Ingresos − Egresos; por_medio suma = Ingresos; arqueo.total.esperado = suma de esperado por medio. Si algo no cierra, warning en consola (no bloquea el export). */
function validarResumen(resumen: any): void {
  const { totales, por_medio, arqueo } = resumen
  const netoEsperado = Number(totales.ingresos) - Number(totales.egresos)
  if (netoEsperado !== Number(totales.neto)) {
    console.warn('[export caja] Neto no coincide con Ingresos − Egresos', { netoEsperado, neto: totales.neto })
  }
  // La suma por medio se compara contra los ingresos DEL CRM (sin la Z: la Z no
  // tiene medio de pago, no se mezcla con el desglose).
  const sumaPorMedio = (por_medio || []).reduce((acc: number, m: any) => acc + Number(m.ingresos || 0), 0)
  if (sumaPorMedio !== Number(totales.ingresos)) {
    console.warn('[export caja] La suma por medio de pago no coincide con Ingresos', { sumaPorMedio, ingresos: totales.ingresos })
  }
  if (arqueo.total?.esperado != null) {
    const sumaEsperadoPorMedio = (arqueo.por_medio || []).reduce((acc: number, m: any) => acc + Number(m.esperado || 0), 0)
    if (sumaEsperadoPorMedio !== Number(arqueo.total.esperado)) {
      console.warn('[export caja] Total esperado no coincide con la suma de esperado por medio', { sumaEsperadoPorMedio, esperado: arqueo.total.esperado })
    }
  }
}

// Nov 2026 ("Cierre Z"): Ingresos y Neto incluyen el Cierre Z — la Z suma al
// total del día, no se compara contra lo registrado (lib/totalDiaCaja.js).
function seccionResumen(resumen: any): Seccion {
  const dia = totalDiaResumen(resumen)
  const filas: Seccion['filas'] = [['Facturas y recibos', formatMontoCsv(dia.facturasYRecibos)]]
  if (dia.conZ) filas.push(['Cierre Z — controlador fiscal', formatMontoCsv(dia.z)])
  const g = resumen.gastos || {}
  filas.push(
    ['Ingresos', formatMontoCsv(dia.ingresos)],
    ['Egresos', formatMontoCsv(dia.egresos)],
    // Nov 2026: el corte F / SF arriba de todo, es lo primero que se mira.
    ['Egresos con factura (F)', formatMontoCsv(g.total_f)],
    ['Egresos sin factura (SF)', formatMontoCsv(g.total_sf)],
    ['% sin factura', g.pct_sf == null ? '' : String(g.pct_sf)],
    ['Neto', formatMontoCsv(dia.neto)],
  )
  return { titulo: 'Resumen', columnas: ['Concepto', 'Monto'], filas }
}

// Sección propia debajo de "Comprobantes del día" (las facturas y recibos),
// con el renglón Facturas y recibos + Cierre Z = Total del día. Sin Z cargada
// no se exporta.
function seccionCierreZ(resumen: any): Seccion {
  const dia = totalDiaResumen(resumen)
  const z = resumen.z || {}
  return {
    titulo: 'Cierre Z (controlador fiscal)',
    columnas: ['N.° de Z', 'Fecha', 'Comprobantes', 'Primero – Último', 'Total'],
    filas: [[
      z.numero || '',
      formatFechaCsv(z.fecha),
      z.cantidad_comprobantes ?? '',
      `${z.primer_comprobante || '—'} – ${z.ultimo_comprobante || '—'}`,
      formatMontoCsv(z.total),
    ]],
    filaTotal: [
      `Facturas y recibos ${formatMontoCsv(dia.facturasYRecibos)} + Cierre Z ${formatMontoCsv(dia.z)} = Total del día`,
      '', '', '',
      formatMontoCsv(dia.total),
    ],
  }
}

function seccionIngresosPorMedio(resumen: any, movimientosCobro: any[]): Seccion {
  const porMedio = (resumen.por_medio || []).filter((m: any) => Number(m.ingresos) > 0)
  const filas = porMedio.map((m: any) => {
    const cantidad = movimientosCobro.filter((mv) => mv.medio === m.medio).length
    return [etiqueta('medio_pago', m.medio), cantidad, formatMontoCsv(m.ingresos)]
  })
  const totalCantidad = movimientosCobro.length
  const totalMonto = porMedio.reduce((acc: number, m: any) => acc + Number(m.ingresos), 0)
  return {
    titulo: 'Ingresos por medio de pago',
    columnas: ['Medio de pago', 'Cantidad', 'Monto'],
    filas,
    filaTotal: ['', totalCantidad, formatMontoCsv(totalMonto)],
  }
}

// Ítem 1 (25/10/2026): el arqueo integra TODOS los medios con movimiento,
// no solo efectivo — una fila por medio (Esperado/Contado/Diferencia/
// Declarado) más una fila Total.
function seccionArqueo(resumen: any): Seccion {
  const { arqueo } = resumen
  const porMedio = arqueo.por_medio || []
  const filas = porMedio.map((m: any) => [
    etiqueta('medio_pago', m.medio),
    formatMontoCsv(m.esperado),
    formatMontoCsv(m.contado),
    formatMontoCsv(m.diferencia),
    m.declarado ? 'Sí' : 'No declarado',
  ])
  return {
    titulo: 'Arqueo',
    columnas: ['Medio de pago', 'Esperado', 'Contado/Verificado', 'Diferencia', 'Declarado'],
    filas,
    filaTotal: ['Total', formatMontoCsv(arqueo.total?.esperado), formatMontoCsv(arqueo.total?.contado), formatMontoCsv(arqueo.total?.diferencia), RESULTADO_ARQUEO(Number(arqueo.total?.diferencia || 0))],
  }
}

function seccionMovimientos(movimientos: any[]): { seccion: Seccion; cobros: any[] } {
  // Orden cronológico, sin anulados (resumen_caja ya solo trae vigentes acá).
  const ordenados = [...movimientos].sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime())
  const filas = ordenados.map((m) => [
    formatHoraCsv(m.hora),
    etiqueta('tipo_movimiento', m.tipo),
    m.comprobante || 'Sin comprobante',
    m.cliente_proveedor || '',
    m.unidad ? unidadNotacionCsv(m.unidad.tipo, m.unidad.numero) : '',
    m.codigo_reserva || '',
    m.concepto || '',
    etiqueta('medio_pago', m.medio),
    m.tipo === 'cobro' ? formatMontoCsv(m.monto) : '',
    m.tipo === 'gasto' ? formatMontoCsv(Math.abs(m.monto)) : '',
    m.cargado_por || '',
  ])
  const totalIngreso = ordenados.filter((m) => m.tipo === 'cobro').reduce((acc, m) => acc + Number(m.monto), 0)
  const totalEgreso = ordenados.filter((m) => m.tipo === 'gasto').reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0)
  return {
    seccion: {
      titulo: 'Movimientos del día',
      columnas: ['Hora', 'Tipo', 'Comprobante', 'Cliente / Proveedor', 'Unidad', 'Código de reserva', 'Concepto', 'Medio de pago', 'Ingreso', 'Egreso', 'Cargado por'],
      filas,
      filaTotal: ['', '', '', '', '', '', '', '', formatMontoCsv(totalIngreso), formatMontoCsv(totalEgreso), ''],
    },
    cobros: ordenados.filter((m) => m.tipo === 'cobro'),
  }
}

/**
 * Egresos detallados (nov 2026): una fila por gasto vigente, con el tipo de
 * comprobante (F / SF), la categoría, el proveedor y los datos de factura.
 * Debajo de "Comprobantes del día" y antes de las anulaciones, con subtotales
 * F y SF en la fila de total — es la sección que le sirve a la contadora.
 */
function seccionEgresos(resumen: any): Seccion {
  const detalle = resumen.gastos?.detalle || []
  const filas = detalle.map((g: any) => [
    formatHoraCsv(g.fecha_hora),
    g.tipo_comprobante || '',
    etiqueta('tipo_comprobante_gasto', g.tipo_comprobante),
    g.categoria_nombre || etiqueta('categoria_gasto', g.categoria),
    g.concepto || '',
    g.proveedor || '',
    g.letra_factura || '',
    g.numero_factura || '',
    etiqueta('medio_pago', g.medio_pago),
    formatMontoCsv(g.monto),
  ])
  const g = resumen.gastos || {}
  return {
    titulo: 'Egresos del día',
    columnas: [
      'Hora', 'Tipo', 'Tipo de comprobante', 'Categoría', 'Concepto', 'Proveedor',
      'Letra de factura', 'N° de factura', 'Medio de pago', 'Monto',
    ],
    filas,
    filaTotal: [
      'Total', '', `Con factura ${formatMontoCsv(g.total_f)} / Sin factura ${formatMontoCsv(g.total_sf)}`,
      '', '', '', '', '', '', formatMontoCsv(g.total),
    ],
  }
}

/** Subtotales de egresos por categoría, con el corte F / SF de cada una. */
function seccionEgresosPorCategoria(resumen: any): Seccion {
  const porCategoria = resumen.gastos?.por_categoria || []
  const filas = porCategoria.map((c: any) => [
    c.nombre || etiqueta('categoria_gasto', c.categoria),
    String(c.cantidad ?? ''),
    formatMontoCsv(c.total_f),
    formatMontoCsv(c.total_sf),
    formatMontoCsv(c.total),
  ])
  const g = resumen.gastos || {}
  return {
    titulo: 'Egresos por categoría',
    columnas: ['Categoría', 'Cantidad', 'Con factura (F)', 'Sin factura (SF)', 'Total'],
    filas,
    filaTotal: ['Total', String(g.cantidad ?? ''), formatMontoCsv(g.total_f), formatMontoCsv(g.total_sf), formatMontoCsv(g.total)],
  }
}

function seccionComprobantes(resumen: any): Seccion {
  const todos = [...(resumen.facturas || []), ...(resumen.recibos || [])]
  const filas = todos.map((c: any) => [
    etiquetaComprobante(c.tipo),
    c.etiqueta || '',
    formatFechaCsv(c.fecha),
    c.cliente || '',
    formatMontoCsv(c.monto_total),
    etiqueta('estado_comprobante', c.estado),
  ])
  return {
    titulo: 'Comprobantes del día',
    columnas: ['Tipo', 'Número', 'Fecha del comprobante', 'Cliente', 'Monto', 'Estado'],
    filas,
  }
}

function seccionAnulaciones(resumen: any): Seccion {
  const pagos = (resumen.anulados?.pagos || []).map((p: any) => [
    formatHoraCsv(p.anulado_at),
    p.comprobante || 'Sin comprobante',
    p.cliente || '',
    p.motivo || '',
    formatMontoCsv(p.monto),
    p.anulado_por || '',
  ])
  const gastos = (resumen.anulados?.gastos || []).map((g: any) => [
    formatHoraCsv(g.anulado_at),
    g.proveedor || '',
    '',
    g.motivo || '',
    formatMontoCsv(g.monto),
    g.anulado_por || '',
  ])
  return {
    titulo: 'Anulaciones',
    columnas: ['Hora', 'Movimiento original (comprobante o código)', 'Cliente', 'Motivo', 'Monto', 'Anulado por'],
    filas: [...pagos, ...gastos],
  }
}

export function construirCierreCajaCsv(resumen: any, meta: MetaExport): string {
  validarResumen(resumen)

  const { cabecera } = resumen
  const { seccion: seccionMov, cobros } = seccionMovimientos(resumen.movimientos || [])
  const ahora = new Date()

  return crearDocumentoCsv({
    titulo: 'Cierre de caja',
    metadatos: [
      ['Fecha de caja', formatFechaCsv(cabecera.fecha)],
      ['Estado', etiqueta('estado_caja', cabecera.estado)],
      ['Abierta por', `${cabecera.abierta_por_nombre || '—'} (${formatHoraCsv(cabecera.abierta_at)})`],
      ['Cerrada por', cabecera.cerrada_at ? `${cabecera.cerrada_por_nombre || '—'} (${formatHoraCsv(cabecera.cerrada_at)})` : '—'],
      ['Exportado el', `${formatFechaCsv(ahora)} ${formatHoraCsv(ahora)}`],
      ['Exportado por', meta.exportadoPorNombre],
    ],
    secciones: [
      seccionResumen(resumen),
      seccionIngresosPorMedio(resumen, cobros),
      seccionArqueo(resumen),
      seccionMov,
      seccionComprobantes(resumen),
      seccionEgresos(resumen),
      seccionEgresosPorCategoria(resumen),
      ...(totalDiaResumen(resumen).conZ ? [seccionCierreZ(resumen)] : []),
      seccionAnulaciones(resumen),
    ],
  })
}

export function descargarCierreCaja(resumen: any, meta: MetaExport): void {
  const csv = construirCierreCajaCsv(resumen, meta)
  descargarCsv(csv, nombreArchivoCsv('caja', resumen.cabecera.fecha, 'cierre'))
}

// CSV del cierre de caja (oct 2026, Tarea 3) — reemplaza por completo al
// viejo `construirCajaCSV` de `lib/caja.js` (borrado, no "mejorado"). Única
// fuente de datos: `resumen_caja(caja_id)`, la misma que ya alimentan
// ResumenCaja.jsx y CajaImpresion.jsx — así pantalla/impresión/CSV nunca
// pueden desalinearse entre sí.
import { crearDocumentoCsv, type Seccion } from './csvBuilder'
import { descargarCsv, nombreArchivoCsv } from './descargarCsv'
import { formatFechaCsv, formatHoraCsv, formatMontoCsv, etiqueta, etiquetaComprobante, unidadNotacionCsv } from './formatos'

interface MetaExport {
  exportadoPorNombre: string
}

const RESULTADO_ARQUEO = (diferencia: number): string => {
  if (diferencia > 0) return 'Sobrante'
  if (diferencia < 0) return 'Faltante'
  return 'Sin diferencia'
}

/** Neto = Ingresos − Egresos; por_medio suma = Ingresos; Esperado = Inicial + ingresos efectivo − egresos efectivo. Si algo no cierra, warning en consola (no bloquea el export). */
function validarResumen(resumen: any): void {
  const { totales, por_medio, arqueo } = resumen
  const netoEsperado = Number(totales.ingresos) - Number(totales.egresos)
  if (netoEsperado !== Number(totales.neto)) {
    console.warn('[export caja] Neto no coincide con Ingresos − Egresos', { netoEsperado, neto: totales.neto })
  }
  const sumaPorMedio = (por_medio || []).reduce((acc: number, m: any) => acc + Number(m.ingresos || 0), 0)
  if (sumaPorMedio !== Number(totales.ingresos)) {
    console.warn('[export caja] La suma por medio de pago no coincide con Ingresos', { sumaPorMedio, ingresos: totales.ingresos })
  }
  if (arqueo.esperado != null) {
    const ingresosEfectivo = (por_medio || []).find((m: any) => m.medio === 'efectivo')?.ingresos || 0
    const egresosEfectivo = (por_medio || []).find((m: any) => m.medio === 'efectivo')?.egresos || 0
    const esperadoCalculado = Number(arqueo.inicial || 0) + Number(ingresosEfectivo) - Number(egresosEfectivo)
    if (esperadoCalculado !== Number(arqueo.esperado)) {
      console.warn('[export caja] Esperado no coincide con Inicial + ingresos efectivo − egresos efectivo', { esperadoCalculado, esperado: arqueo.esperado })
    }
  }
}

function seccionResumen(resumen: any): Seccion {
  const { totales } = resumen
  return {
    titulo: 'Resumen',
    columnas: ['Concepto', 'Monto'],
    filas: [
      ['Ingresos', formatMontoCsv(totales.ingresos)],
      ['Egresos', formatMontoCsv(totales.egresos)],
      ['Neto', formatMontoCsv(totales.neto)],
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

function seccionArqueo(resumen: any): Seccion {
  const { arqueo } = resumen
  const diferencia = Number(arqueo.diferencia || 0)
  return {
    titulo: 'Arqueo de efectivo',
    columnas: ['Concepto', 'Monto'],
    filas: [
      ['Saldo inicial', formatMontoCsv(arqueo.inicial)],
      ['Ingresos en efectivo', formatMontoCsv((resumen.por_medio || []).find((m: any) => m.medio === 'efectivo')?.ingresos || 0)],
      ['Egresos en efectivo', formatMontoCsv((resumen.por_medio || []).find((m: any) => m.medio === 'efectivo')?.egresos || 0)],
      ['Esperado en caja', formatMontoCsv(arqueo.esperado)],
      ['Contado', formatMontoCsv(arqueo.contado)],
      ['Diferencia', formatMontoCsv(diferencia)],
      ['Resultado', RESULTADO_ARQUEO(diferencia)],
    ],
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
      seccionAnulaciones(resumen),
    ],
  })
}

export function descargarCierreCaja(resumen: any, meta: MetaExport): void {
  const csv = construirCierreCajaCsv(resumen, meta)
  descargarCsv(csv, nombreArchivoCsv('caja', resumen.cabecera.fecha, 'cierre'))
}

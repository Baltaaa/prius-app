// Cálculo único de los reportes del balneario (31/10/2026).
//
// Toda la aritmética vive acá, separada de la UI, para que la pantalla, el
// CSV, el PDF, la impresión A4 y el texto de WhatsApp muestren EXACTAMENTE
// los mismos números — mismo criterio que `resumen_caja` para la caja.
//
// Moneda: el peso es la fuente de verdad (pagos.monto siempre está en pesos,
// ver fn_registrar_pago_interno). El switch a USD es solo de PRESENTACIÓN:
// divide por la cotización vigente al momento de mirar el reporte, y por eso
// el encabezado siempre aclara con qué cotización se convirtió.

/** Período de agrupación. */
export const PERIODOS = [
  { value: 'dia', label: 'Diario' },
  { value: 'semana', label: 'Semanal' },
  { value: 'mes', label: 'Mensual' },
  { value: 'anio', label: 'Anual' },
]

const pad = (n) => String(n).padStart(2, '0')

/** yyyy-mm-dd -> Date local sin corrimiento de huso. */
function aFecha(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Lunes de la semana de `f` (ISO: la semana arranca lunes, como el resto de la app). */
function lunesDe(f) {
  const d = new Date(f)
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - dow)
  return d
}

/**
 * Clave e etiqueta del bucket al que cae una fecha, según el período.
 * La clave ordena alfabéticamente igual que cronológicamente.
 */
export function bucketDe(iso, periodo) {
  const f = aFecha(iso)
  if (!f) return null
  if (periodo === 'anio') {
    return { clave: `${f.getFullYear()}`, label: `${f.getFullYear()}` }
  }
  if (periodo === 'mes') {
    const clave = `${f.getFullYear()}-${pad(f.getMonth() + 1)}`
    const nombre = f.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return { clave, label: nombre.charAt(0).toUpperCase() + nombre.slice(1) }
  }
  if (periodo === 'semana') {
    const l = lunesDe(f)
    const clave = `${l.getFullYear()}-${pad(l.getMonth() + 1)}-${pad(l.getDate())}`
    const fin = new Date(l); fin.setDate(fin.getDate() + 6)
    return { clave, label: `${pad(l.getDate())}/${pad(l.getMonth() + 1)} al ${pad(fin.getDate())}/${pad(fin.getMonth() + 1)}` }
  }
  const clave = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`
  return { clave, label: `${pad(f.getDate())}/${pad(f.getMonth() + 1)}/${f.getFullYear()}` }
}

/** Variación porcentual contra el período anterior. null si no hay con qué comparar. */
export function variacion(actual, previo) {
  if (previo == null || previo === 0) return null
  return ((actual - previo) / Math.abs(previo)) * 100
}

/**
 * Serie agrupada de ingresos (pagos vigentes) y egresos (gastos vigentes).
 * Devuelve los buckets ordenados cronológicamente, con neto y variación
 * contra el bucket anterior.
 */
export function construirSerie({ pagos = [], gastos = [], periodo = 'mes', desde = null, hasta = null }) {
  const dentro = (iso) => {
    if (!iso) return false
    const d = String(iso).slice(0, 10)
    if (desde && d < desde) return false
    if (hasta && d > hasta) return false
    return true
  }

  const buckets = new Map()
  const tocar = (clave, label) => {
    if (!buckets.has(clave)) {
      buckets.set(clave, { clave, label, ingresos: 0, egresos: 0, cantidadPagos: 0, cantidadGastos: 0, porMedio: {} })
    }
    return buckets.get(clave)
  }

  for (const p of pagos) {
    if (p.estado !== 'vigente') continue
    const iso = p.fecha || p.fecha_hora
    if (!dentro(iso)) continue
    const b = bucketDe(iso, periodo)
    if (!b) continue
    const row = tocar(b.clave, b.label)
    const monto = Number(p.monto) || 0
    row.ingresos += monto
    row.cantidadPagos += 1
    const medio = p.medio || 'otro'
    row.porMedio[medio] = (row.porMedio[medio] || 0) + monto
  }

  for (const g of gastos) {
    if (g.estado !== 'vigente') continue
    const iso = g.fecha || g.created_at
    if (!dentro(iso)) continue
    const b = bucketDe(iso, periodo)
    if (!b) continue
    const row = tocar(b.clave, b.label)
    row.egresos += Number(g.monto) || 0
    row.cantidadGastos += 1
  }

  const serie = [...buckets.values()].sort((a, b) => a.clave.localeCompare(b.clave))
  return serie.map((row, i) => {
    const neto = row.ingresos - row.egresos
    const previo = i > 0 ? serie[i - 1] : null
    return {
      ...row,
      neto,
      variacionIngresos: previo ? variacion(row.ingresos, previo.ingresos) : null,
      variacionNeto: previo ? variacion(neto, previo.neto) : null,
    }
  })
}

/** Totales del rango completo + promedio por período. */
export function totalesDe(serie) {
  const ingresos = serie.reduce((a, r) => a + r.ingresos, 0)
  const egresos = serie.reduce((a, r) => a + r.egresos, 0)
  const cantidadPagos = serie.reduce((a, r) => a + r.cantidadPagos, 0)
  const neto = ingresos - egresos
  return {
    ingresos,
    egresos,
    neto,
    cantidadPagos,
    ticketPromedio: cantidadPagos > 0 ? ingresos / cantidadPagos : 0,
    promedioPorPeriodo: serie.length > 0 ? ingresos / serie.length : 0,
    margen: ingresos > 0 ? (neto / ingresos) * 100 : 0,
  }
}

/**
 * Proyección simple del período en curso: regla de tres sobre lo transcurrido.
 * Es deliberadamente simple y se muestra SIEMPRE etiquetada como proyección —
 * no pretende ser un modelo, solo responder "si sigue este ritmo, ¿en cuánto
 * termina el mes?".
 */
export function proyectarPeriodoEnCurso(serie, periodo, hoy = new Date()) {
  if (serie.length === 0) return null
  const ultimo = serie[serie.length - 1]
  const bucketHoy = bucketDe(
    `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`,
    periodo,
  )
  // Solo proyecta si el último bucket de la serie ES el período en curso.
  if (!bucketHoy || bucketHoy.clave !== ultimo.clave) return null

  let total, transcurrido
  if (periodo === 'dia') return null // un día no se proyecta a sí mismo
  if (periodo === 'semana') {
    total = 7
    transcurrido = ((hoy.getDay() + 6) % 7) + 1
  } else if (periodo === 'mes') {
    total = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    transcurrido = hoy.getDate()
  } else {
    const inicio = new Date(hoy.getFullYear(), 0, 1)
    total = (new Date(hoy.getFullYear(), 11, 31) - inicio) / 86400000 + 1
    transcurrido = (hoy - inicio) / 86400000 + 1
  }
  if (!transcurrido || transcurrido >= total) return null

  const factor = total / transcurrido
  return {
    label: ultimo.label,
    transcurrido,
    total,
    pctTranscurrido: (transcurrido / total) * 100,
    ingresosProyectados: ultimo.ingresos * factor,
    netoProyectado: ultimo.neto * factor,
    ingresosHastaAhora: ultimo.ingresos,
    netoHastaAhora: ultimo.neto,
  }
}

/** Desglose por medio de pago sobre todo el rango, ordenado de mayor a menor. */
export function desglosePorMedio(serie) {
  const acc = {}
  for (const row of serie) {
    for (const [medio, monto] of Object.entries(row.porMedio)) {
      acc[medio] = (acc[medio] || 0) + monto
    }
  }
  const total = Object.values(acc).reduce((a, b) => a + b, 0)
  return Object.entries(acc)
    .map(([medio, monto]) => ({ medio, monto, pct: total > 0 ? (monto / total) * 100 : 0 }))
    .sort((a, b) => b.monto - a.monto)
}

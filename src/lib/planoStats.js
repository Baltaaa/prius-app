import { STATUS } from '../components/dashboard/constants'
import { saldoNumerico } from './reservas'

// El CRM entró en producción el 1/10/2026 (ver CLAUDE.md) — antes de esa
// fecha, cualquier fila de `caja_diaria` que exista es de prueba/migración,
// nunca un ingreso real. El chip de "Ingresos del día" tiene que mostrar
// "—" sin excepción para esas fechas, aunque haya una fila cargada.
export const FECHA_INICIO_CAJA = '2026-10-01'

/**
 * Deriva todas las stats de PlanoStatsBar a partir de datos que el Plano ya
 * tiene en memoria (el map `units` que arma Dashboard.jsx + `pagos` del
 * DataProvider) — cero queries nuevas. Puro: mismo resultado para el mismo
 * input, así se puede envolver en un solo `useMemo`.
 *
 * `cajaDelDia`: la fila de `caja_diaria` (de `cajaHoy` o `historialCajas`)
 * que corresponde a `selectedDate`, o null si no hay — la resuelve el
 * llamador porque ya tiene ambos arrays a mano.
 */
export function calcularPlanoStats({ units, pagos, cajaDelDia, selectedDate }) {
  const lista = Object.values(units || {})
  const ocupadas = lista.filter((u) => u.status !== STATUS.LIBRE)
  const libres = lista.filter((u) => u.status === STATUS.LIBRE)

  const porTipo = (tipo) => lista.filter((u) => u.type === tipo)
  const ocupadasPorTipo = (tipo) => ocupadas.filter((u) => u.type === tipo)

  const totalCarpas = porTipo('carpa').length
  const totalSombrillas = porTipo('sombrilla').length
  const carpasOcupadas = ocupadasPorTipo('carpa')
  const sombrillasOcupadas = ocupadasPorTipo('sombrilla')

  const esTemporadaLike = (u) => u.status === STATUS.TEMPORADA || u.status === STATUS.PENDIENTE_CONFIRMACION
  const mixUnitIds = {
    temporada: ocupadas.filter(esTemporadaLike).map((u) => u.dbId),
    periodo: ocupadas.filter((u) => u.status === STATUS.PERIODO).map((u) => u.dbId),
    dia: ocupadas.filter((u) => u.status === STATUS.DIA).map((u) => u.dbId),
  }

  // Pendientes de pago: reserva vigente hoy, no bonificada (esas siempre
  // quedan "pagado" por trigger), estado_pago parcial o pendiente —
  // `pendiente_confirmacion` no cuenta: todavía no hay precio pactado, no
  // es una deuda real (misma distinción que `MontoReserva`/`SaldoReserva`).
  const pagosPorReserva = new Map()
  for (const p of pagos || []) {
    if (p.estado === 'anulado') continue
    const arr = pagosPorReserva.get(p.reserva_id) || []
    arr.push(p)
    pagosPorReserva.set(p.reserva_id, arr)
  }
  let pendientesCount = 0
  let pendientesSaldo = 0
  let pendientesSinVerificar = false
  const pendienteUnitIds = []
  for (const u of ocupadas) {
    const r = u.reserva
    if (!r || r.bonificada) continue
    if (r.estado_pago !== 'parcial' && r.estado_pago !== 'pendiente') continue
    pendientesCount += 1
    pendienteUnitIds.push(u.dbId)
    const saldo = saldoNumerico(r, pagosPorReserva.get(r.id) || [])
    if (saldo === null) pendientesSinVerificar = true
    else pendientesSaldo += saldo
  }

  const ingresosDelDia = selectedDate < FECHA_INICIO_CAJA || !cajaDelDia
    ? null
    : Number(cajaDelDia.total_cobros || 0)

  return {
    ocupacion: { count: ocupadas.length, total: lista.length, pct: lista.length ? ocupadas.length / lista.length : 0, unitIds: ocupadas.map((u) => u.dbId) },
    carpas: { count: carpasOcupadas.length, total: totalCarpas, pct: totalCarpas ? carpasOcupadas.length / totalCarpas : 0, unitIds: carpasOcupadas.map((u) => u.dbId) },
    sombrillas: { count: sombrillasOcupadas.length, total: totalSombrillas, pct: totalSombrillas ? sombrillasOcupadas.length / totalSombrillas : 0, unitIds: sombrillasOcupadas.map((u) => u.dbId) },
    mix: { temporada: mixUnitIds.temporada.length, periodo: mixUnitIds.periodo.length, dia: mixUnitIds.dia.length },
    mixUnitIds,
    pendientes: { count: pendientesCount, saldo: pendientesSaldo, sinVerificar: pendientesSinVerificar, unitIds: pendienteUnitIds },
    libres: { count: libres.length, unitIds: libres.map((u) => u.dbId) },
    ingresosDelDia,
  }
}

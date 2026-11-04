import { STATUS } from '../components/dashboard/constants'
import { resumenSaldos } from './saldos'

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
 * `reservas`: todas las reservas (para resolver grupos de precio unificado).
 * `cajaDelDia`: la fila de `caja_diaria` (de `cajaHoy` o `historialCajas`)
 * que corresponde a `selectedDate`, o null si no hay — la resuelve el
 * llamador porque ya tiene ambos arrays a mano.
 */
export function calcularPlanoStats({ units, pagos, reservas, cajaDelDia, selectedDate }) {
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
  const sinConfirmar = ocupadas.filter((u) => u.status === STATUS.PENDIENTE_CONFIRMACION)
  const mixUnitIds = {
    temporada: ocupadas.filter(esTemporadaLike).map((u) => u.dbId),
    periodo: ocupadas.filter((u) => u.status === STATUS.PERIODO).map((u) => u.dbId),
    dia: ocupadas.filter((u) => u.status === STATUS.DIA).map((u) => u.dbId),
  }

  // Pendientes del día: saldo de las reservas de las unidades ocupadas en
  // `selectedDate` — mismo cálculo que la ficha y que el Home (lib/saldos.js),
  // nunca `estado_pago` ni la columna `reserva.saldo`. Alcance: solo lo que
  // ocupa el mapa ese día; el Home suma la temporada completa.
  const reservasOcupadas = ocupadas.map((u) => u.reserva).filter(Boolean)
  const saldos = resumenSaldos({ reservas: reservasOcupadas, pagos, todasLasReservas: reservas })
  const idsPendientes = new Set(saldos.reservaIdsPendientes)
  const pendienteUnitIds = ocupadas.filter((u) => u.reserva && idsPendientes.has(u.reserva.id)).map((u) => u.dbId)
  const pendientesCount = pendienteUnitIds.length
  const pendientesSaldo = saldos.pendiente
  const pendientesSinVerificar = saldos.sinVerificar > 0

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
    sinConfirmar: { count: sinConfirmar.length, unitIds: sinConfirmar.map((u) => u.dbId) },
    ingresosDelDia,
  }
}

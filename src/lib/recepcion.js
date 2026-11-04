import { reservaActiva } from './reservas'
import { resumenSaldos } from './saldos'
import { fechaAR } from './fechas'

// Lógica pura de la pantalla de Recepción: qué reservas web llegan hoy, cuáles
// ya ingresaron y cuál fue el último check-in. Todo sale de datos que el
// DataProvider ya tiene en memoria (reservas, codigos_reserva, pagos): cero
// consultas nuevas. Los saldos usan la fuente única (lib/saldos.js).

// Mismo criterio de siempre: una reserva por día o período está "hoy" si su
// rango cubre la fecha. La temporada no tiene check-in por código.
export function enRangoHoy(r, hoy) {
  if (r.tipo_alquiler === 'dia') return r.fecha === hoy
  if (r.tipo_alquiler === 'periodo') return r.fecha_inicio <= hoy && hoy <= r.fecha_fin
  return false
}

// Un código agrupa las 1-2 unidades de una reserva web.
export function armarGrupo({ codigo, codigoRow, reservas, pagos }) {
  const rs = reservas.filter((r) => r.codigo === codigo)
  if (!rs.length) return null
  const saldos = resumenSaldos({ reservas: rs, pagos })
  const titular = `${rs[0].clientes?.nombre || ''} ${rs[0].clientes?.apellido || ''}`.trim() || 'S/N'
  return {
    codigo,
    codigoRow: codigoRow || null,
    reservas: rs,
    titular,
    personas: rs.reduce((acc, r) => acc + (r.cantidad_personas || 0), 0),
    saldo: saldos.pendiente,
    sinVerificar: saldos.sinVerificar > 0,
    conSaldo: saldos.pendiente > 0 || saldos.sinVerificar > 0,
    ingresoAt: codigoRow?.checkin_at || null,
  }
}

export function llegadasDelDia({ reservas, codigosReserva, pagos, hoy }) {
  const filaPorCodigo = new Map((codigosReserva || []).map((c) => [c.codigo, c]))
  const ingresaronHoy = (codigosReserva || []).filter((c) => c.checkin_at && fechaAR(c.checkin_at) === hoy)

  const pendientes = []
  const vistos = new Set()
  for (const r of reservas || []) {
    if (r.origen !== 'web' || !r.codigo || vistos.has(r.codigo)) continue
    const fila = filaPorCodigo.get(r.codigo)
    if (fila?.checkin_at) continue
    if (!reservaActiva(r) || !enRangoHoy(r, hoy)) continue
    vistos.add(r.codigo)
    pendientes.push(armarGrupo({ codigo: r.codigo, codigoRow: fila, reservas, pagos }))
  }
  pendientes.sort((a, b) => a.titular.localeCompare(b.titular, 'es'))

  const ingresados = ingresaronHoy
    .map((c) => armarGrupo({ codigo: c.codigo, codigoRow: c, reservas, pagos }))
    .filter(Boolean)
    .sort((a, b) => new Date(b.ingresoAt) - new Date(a.ingresoAt))

  return {
    items: [...pendientes, ...ingresados],
    stats: {
      total: pendientes.length + ingresados.length,
      ingresados: ingresados.length,
      pendientes: pendientes.length,
    },
    ultimo: ingresados[0] || null, // el check-in más reciente de hoy
  }
}

export const FILTROS_LLEGADAS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'saldo', label: 'Con saldo' },
]

export function filtrarLlegadas(items, filtro) {
  if (filtro === 'pendientes') return items.filter((i) => !i.ingresoAt)
  if (filtro === 'saldo') return items.filter((i) => i.conSaldo)
  return items
}

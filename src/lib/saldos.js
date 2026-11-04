import { esPendienteConfirmacion, esGrupo, saldoNumerico, saldoGrupo } from './reservas'

// Única fuente de verdad de saldos y cobranzas agregados (Home, Plano y
// cualquier otra pantalla que sume pendientes). Usa EXACTAMENTE la misma
// lógica que la ficha individual (`saldoNumerico`, y `saldoGrupo` para
// reservas con precio unificado): nunca lee la columna suelta `reserva.saldo`
// ni filtra por `estado_pago`, que pueden divergir de lo que muestra la ficha.
//
// El alcance lo decide quien llama con la lista `reservas` que pasa:
//   - Temporada: todas las reservas vigentes (Home).
//   - Del día: solo las reservas de las unidades ocupadas en una fecha (Plano).
// `todasLasReservas` solo hace falta para resolver los grupos (precio
// unificado) cuando `reservas` es un subconjunto.
//
// Una reserva con saldo `null` (precio ambiguo o pago sin monto verificado)
// nunca se suma como $0: se cuenta aparte en `sinVerificar`.

export function pagosVigentesPorReserva(pagos) {
  const map = {}
  for (const p of pagos || []) {
    if (p.estado === 'anulado') continue
    ;(map[p.reserva_id] ||= []).push(p)
  }
  return map
}

/**
 * @param {{ reservas: any[], pagos: any[], todasLasReservas?: any[] }} args
 */
export function resumenSaldos({ reservas, pagos, todasLasReservas }) {
  const universo = todasLasReservas || reservas || []
  const pagosPorReserva = pagosVigentesPorReserva(pagos)
  const saldoPorGrupo = new Map()

  let facturado = 0
  let cobrado = 0
  let pendiente = 0
  let conSaldo = 0
  let sinVerificar = 0
  const reservaIdsPendientes = []

  for (const r of reservas || []) {
    if (!r || r.estado === 'cancelada' || r.bonificada) continue
    cobrado += (pagosPorReserva[r.id] || []).reduce((acc, p) => acc + Number(p.monto || 0), 0)

    if (esGrupo(r)) {
      // Un grupo comparte un solo precio y un solo saldo: se cuenta una vez,
      // pero todas sus reservas figuran como pendientes si hay deuda.
      let primera = false
      if (!saldoPorGrupo.has(r.grupo_id)) {
        saldoPorGrupo.set(r.grupo_id, saldoGrupo(r, universo, pagosPorReserva))
        facturado += Number(r.reserva_grupos.precio_total || 0)
        primera = true
      }
      const saldo = saldoPorGrupo.get(r.grupo_id)
      if (saldo === null || saldo > 0) reservaIdsPendientes.push(r.id)
      if (primera) {
        if (saldo === null) sinVerificar += 1
        else if (saldo > 0) { pendiente += saldo; conSaldo += 1 }
      }
      continue
    }

    facturado += Number(r.valor_total || 0)
    if (esPendienteConfirmacion(r)) continue
    const saldo = saldoNumerico(r, pagosPorReserva[r.id] || [])
    if (saldo === null) { sinVerificar += 1; reservaIdsPendientes.push(r.id) }
    else if (saldo > 0) { pendiente += saldo; conSaldo += 1; reservaIdsPendientes.push(r.id) }
  }

  return {
    facturado,
    cobrado,
    pendiente,
    conSaldo,
    sinVerificar,
    // Reservas con deuda o sin verificar: lo que cuenta cada "Pendientes".
    cantidad: conSaldo + sinVerificar,
    reservaIdsPendientes,
    pctCobrado: facturado > 0 ? cobrado / facturado : 0,
  }
}

import { describe, it, expect } from 'vitest'
import { resumenSaldos } from './saldos'
import { saldoNumerico } from './reservas'

const reserva = (id: string, valor: number, extra: Record<string, unknown> = {}) => ({
  id, estado: 'activa', estado_pago: 'parcial', valor_total: valor, saldo: null, bonificada: false, ...extra,
})
const pago = (reserva_id: string, monto: number | null, extra: Record<string, unknown> = {}) => ({
  id: `${reserva_id}-${monto}-${Math.random()}`, reserva_id, monto, estado: 'vigente', comprobantes: [{ estado: 'vigente' }], ...extra,
})

describe('resumenSaldos', () => {
  it('descuenta pagos históricos igual que los de hoy', () => {
    const r = [reserva('a', 5_000_000)]
    const antes = resumenSaldos({ reservas: r, pagos: [] })
    const despues = resumenSaldos({ reservas: r, pagos: [pago('a', 3_360_000, { es_historico: true }), pago('a', 1_200_000)] })
    expect(antes.pendiente).toBe(5_000_000)
    expect(despues.pendiente).toBe(440_000)
    expect(despues.cobrado).toBe(4_560_000)
  })

  it('ignora pagos anulados', () => {
    const r = [reserva('a', 1_000_000)]
    const s = resumenSaldos({ reservas: r, pagos: [pago('a', 400_000), pago('a', 600_000, { estado: 'anulado' })] })
    expect(s.pendiente).toBe(600_000)
    expect(s.cobrado).toBe(400_000)
  })

  it('un pago sin monto verificado no se cuenta como $0 ni como cobrado: va a sinVerificar', () => {
    const r = [reserva('a', 3_600_000), reserva('b', 1_000_000)]
    const s = resumenSaldos({ reservas: r, pagos: [pago('a', null), pago('a', 600_000)] })
    expect(s.sinVerificar).toBe(1)
    expect(s.pendiente).toBe(1_000_000)
    expect(s.cantidad).toBe(2)
    expect(s.reservaIdsPendientes).toEqual(['a', 'b'])
  })

  it('coincide con la ficha individual (saldoNumerico) en cada reserva', () => {
    const rs = [reserva('a', 4_400_000), reserva('b', 4_512_000), reserva('c', 4_680_000)]
    const ps = [pago('a', 1_100_000), pago('a', 1_100_000), pago('a', 1_100_000), pago('b', 4_512_000), pago('c', 1_170_000)]
    const esperado = rs.reduce((acc, r) => acc + (saldoNumerico(r, ps.filter((p) => p.reserva_id === r.id)) ?? 0), 0)
    expect(resumenSaldos({ reservas: rs, pagos: ps }).pendiente).toBe(esperado)
  })

  it('no mira estado_pago ni la columna saldo: usa los pagos', () => {
    const r = [reserva('a', 1_000_000, { estado_pago: 'pagado', saldo: 0 })]
    expect(resumenSaldos({ reservas: r, pagos: [pago('a', 250_000)] }).pendiente).toBe(750_000)
  })

  it('deja afuera canceladas, bonificadas y pendiente_confirmacion', () => {
    const r = [
      reserva('a', 1_000_000, { estado: 'cancelada' }),
      reserva('b', 1_000_000, { bonificada: true }),
      reserva('c', 1_000_000, { estado_pago: 'pendiente_confirmacion' }),
    ]
    const s = resumenSaldos({ reservas: r, pagos: [] })
    expect(s.pendiente).toBe(0)
    expect(s.cantidad).toBe(0)
  })

  it('un grupo con precio unificado cuenta una sola vez', () => {
    const grupo = { precio_total: 3_100_000 }
    const rs = [
      reserva('a', 0, { grupo_id: 'g', reserva_grupos: grupo }),
      reserva('b', 0, { grupo_id: 'g', reserva_grupos: grupo }),
    ]
    const s = resumenSaldos({ reservas: rs, pagos: [pago('a', 1_000_000)] })
    expect(s.pendiente).toBe(2_100_000)
    expect(s.conSaldo).toBe(1)
    expect(s.facturado).toBe(3_100_000)
    expect(s.reservaIdsPendientes).toEqual(['a', 'b'])
  })

  it('el alcance lo da la lista: el día es un subconjunto de la temporada', () => {
    const rs = [reserva('temp', 4_000_000), reserva('futura', 1_050_000)]
    const ps = [pago('temp', 1_000_000)]
    const temporada = resumenSaldos({ reservas: rs, pagos: ps })
    const delDia = resumenSaldos({ reservas: [rs[0]], pagos: ps, todasLasReservas: rs })
    expect(temporada.pendiente).toBe(4_050_000)
    expect(delDia.pendiente).toBe(3_000_000)
  })
})

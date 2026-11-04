import { describe, it, expect } from 'vitest'
import { llegadasDelDia, filtrarLlegadas, enRangoHoy } from './recepcion'
import { hoyAR, fechaAR } from './fecha'

const HOY = '2026-11-03'
const web = (codigo: string, extra: Record<string, unknown> = {}) => ({
  id: `r-${codigo}`, codigo, origen: 'web', estado: 'activa', preconfirmada: false, tipo_alquiler: 'dia', fecha: HOY,
  valor_total: 100_000, bonificada: false, estado_pago: 'pendiente', cantidad_personas: 2, clientes: { nombre: 'Ana Lopez' }, ...extra,
})
const fila = (codigo: string, extra: Record<string, unknown> = {}) => ({ codigo, checkin_at: null, ...extra })

describe('recepcion', () => {
  it('cuenta llegan hoy, ingresados y pendientes con datos reales', () => {
    const reservas = [web('PRIUS-AAAAAA'), web('PRIUS-BBBBBB'), web('PRIUS-CCCCCC', { fecha: '2026-11-04' })]
    const codigos = [fila('PRIUS-AAAAAA'), fila('PRIUS-BBBBBB', { checkin_at: '2026-11-03T15:30:00Z' }), fila('PRIUS-CCCCCC')]
    const r = llegadasDelDia({ reservas, codigosReserva: codigos, pagos: [], hoy: HOY })
    expect(r.stats).toEqual({ total: 2, ingresados: 1, pendientes: 1 })
    expect(r.items.map((i: { codigo: string }) => i.codigo)).toEqual(['PRIUS-AAAAAA', 'PRIUS-BBBBBB']) // pendientes primero
    expect(r.ultimo?.codigo).toBe('PRIUS-BBBBBB')
  })

  it('un check-in de otro día no cuenta como ingresado de hoy', () => {
    const reservas = [web('PRIUS-AAAAAA')]
    const codigos = [fila('PRIUS-AAAAAA', { checkin_at: '2026-11-02T15:30:00Z' })]
    const r = llegadasDelDia({ reservas, codigosReserva: codigos, pagos: [], hoy: HOY })
    expect(r.stats.total).toBe(0)
    expect(r.ultimo).toBeNull()
  })

  it('el último escaneo es el check-in más reciente de hoy', () => {
    const reservas = [web('PRIUS-AAAAAA'), web('PRIUS-BBBBBB')]
    const codigos = [
      fila('PRIUS-AAAAAA', { checkin_at: '2026-11-03T13:00:00Z' }),
      fila('PRIUS-BBBBBB', { checkin_at: '2026-11-03T16:45:00Z' }),
    ]
    expect(llegadasDelDia({ reservas, codigosReserva: codigos, pagos: [], hoy: HOY }).ultimo?.codigo).toBe('PRIUS-BBBBBB')
  })

  it('el saldo sale de los pagos, no de la columna', () => {
    const reservas = [web('PRIUS-AAAAAA', { saldo: 0 })]
    const pagos = [{ id: 'p1', reserva_id: 'r-PRIUS-AAAAAA', monto: 40_000, estado: 'vigente', comprobantes: [] }]
    const g = llegadasDelDia({ reservas, codigosReserva: [fila('PRIUS-AAAAAA')], pagos, hoy: HOY }).items[0]
    expect(g.saldo).toBe(60_000)
    expect(g.conSaldo).toBe(true)
  })

  it('filtra Pendientes y Con saldo', () => {
    const reservas = [web('PRIUS-AAAAAA'), web('PRIUS-BBBBBB')]
    const codigos = [fila('PRIUS-AAAAAA'), fila('PRIUS-BBBBBB', { checkin_at: '2026-11-03T15:30:00Z' })]
    const pagos = [{ id: 'p', reserva_id: 'r-PRIUS-BBBBBB', monto: 100_000, estado: 'vigente', comprobantes: [] }]
    const { items } = llegadasDelDia({ reservas, codigosReserva: codigos, pagos, hoy: HOY })
    expect(filtrarLlegadas(items, 'pendientes').map((i: { codigo: string }) => i.codigo)).toEqual(['PRIUS-AAAAAA'])
    expect(filtrarLlegadas(items, 'saldo').map((i: { codigo: string }) => i.codigo)).toEqual(['PRIUS-AAAAAA'])
    expect(filtrarLlegadas(items, 'todos')).toHaveLength(2)
  })

  it('ignora reservas no web, sin código o canceladas', () => {
    const reservas = [web('PRIUS-AAAAAA', { origen: 'crm' }), web('PRIUS-BBBBBB', { estado: 'cancelada' }), web('', { codigo: null })]
    expect(llegadasDelDia({ reservas, codigosReserva: [], pagos: [], hoy: HOY }).stats.total).toBe(0)
  })

  it('períodos: está hoy si el rango cubre la fecha', () => {
    expect(enRangoHoy({ tipo_alquiler: 'periodo', fecha_inicio: '2026-11-01', fecha_fin: '2026-11-05' }, HOY)).toBe(true)
    expect(enRangoHoy({ tipo_alquiler: 'periodo', fecha_inicio: '2026-11-04', fecha_fin: '2026-11-05' }, HOY)).toBe(false)
    expect(enRangoHoy({ tipo_alquiler: 'temporada' }, HOY)).toBe(false)
  })
})

describe('fecha (hora de Argentina)', () => {
  it('a las 23:30 de Argentina todavía es el mismo día, aunque en UTC ya sea el siguiente', () => {
    expect(fechaAR('2026-11-04T02:30:00Z')).toBe('2026-11-03')
    expect(fechaAR('2026-11-03T23:59:00Z')).toBe('2026-11-03')
    expect(fechaAR('2026-11-04T03:00:00Z')).toBe('2026-11-04')
    expect(hoyAR()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(fechaAR(null)).toBeNull()
  })
})

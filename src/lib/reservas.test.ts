import { describe, it, expect } from 'vitest'
import { reservaActiva } from './reservas'

describe('reservaActiva', () => {
  it('activa normal (no preconfirmada) siempre ocupa', () => {
    expect(reservaActiva({ estado: 'activa', preconfirmada: false, vence_at: null })).toBe(true)
  })

  it('cancelada nunca ocupa', () => {
    expect(reservaActiva({ estado: 'cancelada', preconfirmada: false, vence_at: null })).toBe(false)
  })

  it('preconfirmada vigente (vence_at en el futuro) ocupa', () => {
    const vence = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(reservaActiva({ estado: 'activa', preconfirmada: true, vence_at: vence })).toBe(true)
  })

  it('preconfirmada vencida (vence_at en el pasado) no ocupa', () => {
    const vence = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(reservaActiva({ estado: 'activa', preconfirmada: true, vence_at: vence })).toBe(false)
  })

  it('preconfirmada con vence_at nulo ocupa (ya no puede vencer, ver D6)', () => {
    expect(reservaActiva({ estado: 'activa', preconfirmada: true, vence_at: null })).toBe(true)
  })
})

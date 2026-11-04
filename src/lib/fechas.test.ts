import { describe, expect, it } from 'vitest'
import { fechaAR, hoyAR, msHastaMedianocheAR, sumarDias, sumarMeses } from './fechas'

// ART = UTC-3 todo el año. 20:59 ART = 23:59Z, 21:00 ART = 00:00Z (+1), 23:59 ART = 02:59Z (+1),
// 00:00 ART = 03:00Z (+1).
describe('el día en hora argentina', () => {
  it('20:59 ART sigue siendo el mismo día', () => {
    expect(fechaAR('2026-11-03T23:59:00Z')).toBe('2026-11-03')
  })
  it('21:00 ART sigue siendo el mismo día (en UTC ya es el siguiente)', () => {
    expect(fechaAR('2026-11-04T00:00:00Z')).toBe('2026-11-03')
    expect('2026-11-04T00:00:00Z'.slice(0, 10)).toBe('2026-11-04') // lo que hacía el bug
  })
  it('23:59 ART sigue siendo el mismo día', () => {
    expect(fechaAR('2026-11-04T02:59:59Z')).toBe('2026-11-03')
  })
  it('00:00 ART cambia el día', () => {
    expect(fechaAR('2026-11-04T03:00:00Z')).toBe('2026-11-04')
  })
  it('hoyAR coincide con fechaAR(ahora)', () => {
    expect(hoyAR()).toBe(fechaAR(new Date()))
  })
  it('sin valor o inválido devuelve null', () => {
    expect(fechaAR(null)).toBeNull()
    expect(fechaAR('no es fecha')).toBeNull()
  })
})

describe('msHastaMedianocheAR', () => {
  it('a las 23:59:00 ART faltan 60 segundos', () => {
    expect(msHastaMedianocheAR(Date.parse('2026-11-04T02:59:00Z'))).toBe(60_000)
  })
  it('a las 00:00 ART exactas faltan 24 horas', () => {
    expect(msHastaMedianocheAR(Date.parse('2026-11-04T03:00:00Z'))).toBe(86_400_000)
  })
  it('a las 21:00 ART faltan 3 horas', () => {
    expect(msHastaMedianocheAR(Date.parse('2026-11-04T00:00:00Z'))).toBe(3 * 3_600_000)
  })
  it('a las 00:01 ART faltan 23h59m', () => {
    expect(msHastaMedianocheAR(Date.parse('2026-11-04T03:01:00Z'))).toBe(86_400_000 - 60_000)
  })
})

describe('sumarDias / sumarMeses', () => {
  it('cruzan fin de mes y de año', () => {
    expect(sumarDias('2026-11-01', -1)).toBe('2026-10-31')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarMeses('2026-11-04', -12)).toBe('2025-11-04')
  })
})

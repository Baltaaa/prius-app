import { describe, expect, it } from 'vitest'
import { cajasConArqueoPendiente, ddmm, minutosParaMedianoche, nivelAvisoCierre } from './cierreCaja'

// ART = UTC-3: 23:30 ART = 02:30Z (+1), 23:55 = 02:55Z, 00:00 ART = 03:00Z.
describe('aviso de cierre de caja', () => {
  it('a las 22:00 ART no avisa', () => {
    expect(nivelAvisoCierre(new Date('2026-11-04T01:00:00Z'))).toBeNull()
  })
  it('23:29 ART todavía no, 23:30 ART avisa', () => {
    expect(nivelAvisoCierre(new Date('2026-11-04T02:29:00Z'))).toBeNull()
    expect(nivelAvisoCierre(new Date('2026-11-04T02:30:00Z'))?.nivel).toBe('aviso')
  })
  it('23:55 ART es urgente', () => {
    expect(nivelAvisoCierre(new Date('2026-11-04T02:55:00Z'))?.nivel).toBe('urgente')
    expect(minutosParaMedianoche(new Date('2026-11-04T02:55:00Z'))).toBe(5)
  })
  it('00:00 ART vuelve a faltar un día entero (ya no avisa)', () => {
    expect(nivelAvisoCierre(new Date('2026-11-04T03:00:00Z'))).toBeNull()
  })
})

describe('arqueo pendiente', () => {
  it('lista solo las cerradas automáticamente con arqueo pendiente, la más vieja primero', () => {
    const l = cajasConArqueoPendiente([
      { fecha: '2026-11-03', cierre_automatico: true, arqueo_pendiente: true },
      { fecha: '2026-11-01', cierre_automatico: true, arqueo_pendiente: true },
      { fecha: '2026-11-02', cierre_automatico: true, arqueo_pendiente: false },
      { fecha: '2026-10-30', cierre_automatico: false, arqueo_pendiente: false },
    ])
    expect(l.map((c: { fecha: string }) => c.fecha)).toEqual(['2026-11-01', '2026-11-03'])
  })
  it('ddmm', () => { expect(ddmm('2026-11-04')).toBe('04/11') })
})

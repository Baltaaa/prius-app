import { describe, it, expect } from 'vitest'
import {
  formatPesos, formatPesosVisible, formatPesosCSV, formatFecha, formatFechaHora,
  formatRangoFechas, formatDNI, formatCUIT, formatComprobante, formatUnidad,
} from './format'

describe('formatPesos', () => {
  it('formatea miles con punto y sin centavos', () => {
    expect(formatPesos(1089000)).toBe('$ 1.089.000')
  })
  it('cero se muestra como "$ 0"', () => {
    expect(formatPesos(0)).toBe('$ 0')
    expect(formatPesos(null)).toBe('$ 0')
    expect(formatPesos(undefined)).toBe('$ 0')
  })
  it('negativos con signo menos real (U+2212) antes del $', () => {
    expect(formatPesos(-15000)).toBe('−$ 15.000')
    expect(formatPesos(-15000)[0]).toBe('−')
  })
  it('redondea decimales', () => {
    expect(formatPesos(1000.6)).toBe('$ 1.001')
  })
  it('números grandes, sin abreviar', () => {
    expect(formatPesos(99999999999)).toBe('$ 99.999.999.999')
  })
})

describe('formatPesosVisible', () => {
  it('null si no es mayor a 0 (nunca "$ 0")', () => {
    expect(formatPesosVisible(0)).toBeNull()
    expect(formatPesosVisible(null)).toBeNull()
    expect(formatPesosVisible(-100)).toBeNull()
  })
  it('formatea si es mayor a 0', () => {
    expect(formatPesosVisible(500)).toBe('$ 500')
  })
})

describe('formatPesosCSV', () => {
  it('entero plano sin separadores', () => {
    expect(formatPesosCSV(1089000)).toBe('1089000')
    expect(formatPesosCSV(-15000)).toBe('-15000')
    expect(formatPesosCSV(null)).toBe('0')
  })
})

describe('formatFecha / formatFechaHora (zona AR)', () => {
  it('columna date pura no se corre un día por UTC', () => {
    expect(formatFecha('2026-09-30')).toBe('30/09/2026')
  })
  it('timestamptz cerca de medianoche AR se muestra en el día correcto de AR', () => {
    // 2026-10-01T02:30:00Z = 2026-09-30 23:30 en America/Argentina/Buenos_Aires (UTC-3)
    expect(formatFechaHora('2026-10-01T02:30:00Z')).toBe('30/09/2026 23:30')
  })
})

describe('formatRangoFechas', () => {
  it('estilo carpero sin año, incluso cruzando dic->ene de la misma temporada', () => {
    expect(formatRangoFechas('2026-12-27', '2027-01-09')).toBe('27/12 al 09/01')
  })
  it('un solo día', () => {
    expect(formatRangoFechas('2026-12-27', '2026-12-27')).toBe('27/12')
  })
  it('con año cuando el llamador lo pide (temporada no activa)', () => {
    expect(formatRangoFechas('2025-12-27', '2026-01-09', true)).toBe('27/12/25 al 09/01/26')
  })
})

describe('formatDNI / formatCUIT', () => {
  it('DNI con puntos de miles', () => {
    expect(formatDNI('30123456')).toBe('30.123.456')
    expect(formatDNI(30123456)).toBe('30.123.456')
  })
  it('CUIT con guiones', () => {
    expect(formatCUIT('20301234567')).toBe('20-30123456-7')
  })
})

describe('formatComprobante', () => {
  it('sigla-numero, sin punto de venta ni ceros a la izquierda', () => {
    expect(formatComprobante('factura_b', 727)).toBe('FB-727')
  })
  it('recibo b', () => {
    expect(formatComprobante('recibo_b', 3663)).toBe('RB-3663')
  })
})

describe('formatUnidad', () => {
  it('tipo + número', () => {
    expect(formatUnidad('carpa', 19)).toBe('Carpa 19')
    expect(formatUnidad('sombrilla', 4)).toBe('Sombrilla 4')
  })
})

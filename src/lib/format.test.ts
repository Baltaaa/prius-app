import { describe, it, expect } from 'vitest'
import {
  formatPesos, formatPesosVisible, formatPesosCSV, formatFecha, formatFechaHora,
  formatRangoFechas, formatDNI, formatCUIT, formatComprobante, formatUnidad,
  formatMontosEnTexto, formatPorcentaje, formatPesosCompacto, formatDolares,
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

describe('formatMontosEnTexto', () => {
  it('formatea un monto crudo con $ pegado a los dígitos', () => {
    expect(formatMontosEnTexto('Pago editado — $1200000')).toBe('Pago editado — $ 1.200.000')
  })
  it('formatea varios montos en el mismo texto', () => {
    expect(formatMontosEnTexto('De $100000 a $250000')).toBe('De $ 100.000 a $ 250.000')
  })
  it('es idempotente: un monto ya formateado no vuelve a matchear', () => {
    expect(formatMontosEnTexto('Pago registrado — $ 1.200.000 efectivo')).toBe('Pago registrado — $ 1.200.000 efectivo')
  })
  it('no toca comprobantes, DNI, unidades ni fechas (ningún "$" delante)', () => {
    expect(formatMontosEnTexto('Comprobante editado — recibo_b 1880')).toBe('Comprobante editado — recibo_b 1880')
    expect(formatMontosEnTexto('Caja abierta — 2026-10-24')).toBe('Caja abierta — 2026-10-24')
    expect(formatMontosEnTexto('Unidad carpa #74 → ocupada')).toBe('Unidad carpa #74 → ocupada')
  })
  it('vacío/null no rompe', () => {
    expect(formatMontosEnTexto(null)).toBe('')
    expect(formatMontosEnTexto(undefined)).toBe('')
  })
})

describe('formatPorcentaje', () => {
  it('entero por defecto', () => {
    expect(formatPorcentaje(87)).toBe('87%')
  })
  it('con decimales, coma como separador (es-AR)', () => {
    expect(formatPorcentaje(12.5, 1)).toBe('12,5%')
  })
})

describe('formatPesosCompacto', () => {
  it('abrevia millones', () => {
    expect(formatPesosCompacto(1_500_000)).toBe('$1.5M')
  })
  it('abrevia miles', () => {
    expect(formatPesosCompacto(850_000)).toBe('$850K')
  })
  it('por debajo de mil, monto entero sin abreviar', () => {
    expect(formatPesosCompacto(500)).toBe('$ 500')
  })
})

describe('formatDolares', () => {
  it('con prefijo US$ y separadores de miles', () => {
    expect(formatDolares(1200)).toBe('US$ 1.200')
  })
})

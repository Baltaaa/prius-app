import { describe, it, expect, afterEach } from 'vitest'
import {
  formatCantidad, formatMonto, formatMontoVisible, formatMontoReal, formatMontoUSDReal, setMontosOcultos, MONTO_OCULTO, formatPesosCSV, formatFecha, formatFechaHora,
  formatRangoFechas, formatDNI, formatCUIT, formatComprobante, formatUnidad,
  formatMontosEnTexto, formatPorcentaje, formatMontoCompacto, formatMontoUSD,
} from './format'

describe('formatMonto', () => {
  it('formatea miles con punto y sin centavos', () => {
    expect(formatMonto(1089000)).toBe('$ 1.089.000')
  })
  it('cero se muestra como "$ 0"', () => {
    expect(formatMonto(0)).toBe('$ 0')
    expect(formatMonto(null)).toBe('$ 0')
    expect(formatMonto(undefined)).toBe('$ 0')
  })
  it('negativos con signo menos real (U+2212) antes del $', () => {
    expect(formatMonto(-15000)).toBe('−$ 15.000')
    expect(formatMonto(-15000)[0]).toBe('−')
  })
  it('redondea decimales', () => {
    expect(formatMonto(1000.6)).toBe('$ 1.001')
  })
  it('números grandes, sin abreviar', () => {
    expect(formatMonto(99999999999)).toBe('$ 99.999.999.999')
  })
})

describe('formatMontoVisible', () => {
  it('null si no es mayor a 0 (nunca "$ 0")', () => {
    expect(formatMontoVisible(0)).toBeNull()
    expect(formatMontoVisible(null)).toBeNull()
    expect(formatMontoVisible(-100)).toBeNull()
  })
  it('formatea si es mayor a 0', () => {
    expect(formatMontoVisible(500)).toBe('$ 500')
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
    expect(formatMontosEnTexto('Unidad carpa #74 → ocupada')).toBe('Unidad carpa 74 → ocupada')
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

describe('formatMontoCompacto', () => {
  it('abrevia millones', () => {
    expect(formatMontoCompacto(1_500_000)).toBe('$1.5M')
  })
  it('abrevia miles', () => {
    expect(formatMontoCompacto(850_000)).toBe('$850K')
  })
  it('por debajo de mil, monto entero sin abreviar', () => {
    expect(formatMontoCompacto(500)).toBe('$ 500')
  })
})

describe('formatMontoUSD', () => {
  it('con prefijo US$ y separadores de miles', () => {
    expect(formatMontoUSD(1200)).toBe('US$ 1.200')
  })
})

describe('formatCantidad', () => {
  it('separa miles y redondea', () => {
    expect(formatCantidad(1234)).toBe('1.234')
    expect(formatCantidad(7)).toBe('7')
    expect(formatCantidad(null)).toBe('0')
  })
})

describe('modo privacidad', () => {
  afterEach(() => setMontosOcultos(false))

  it('activo: todo monto sale "$ ••••••" (pesos, compacto, dólares, visible)', () => {
    setMontosOcultos(true)
    expect(formatMonto(1089000)).toBe(MONTO_OCULTO)
    expect(formatMonto(-15000)).toBe(MONTO_OCULTO)
    expect(formatMonto(0)).toBe(MONTO_OCULTO)
    expect(formatMontoCompacto(1200000)).toBe(MONTO_OCULTO)
    expect(formatMontoUSD(1200)).toBe(MONTO_OCULTO)
    expect(formatMontoVisible(500)).toBe(MONTO_OCULTO)
    expect(formatMontoVisible(0)).toBeNull()
    expect(MONTO_OCULTO.replace(/\s/g, ' ')).toBe('$ ••••••')
  })

  it('activo: impresiones y exportaciones siguen con el monto real', () => {
    setMontosOcultos(true)
    expect(formatMontoReal(1089000)).toBe('$ 1.089.000')
    expect(formatMontoReal(-15000)).toBe('−$ 15.000')
    expect(formatMontoUSDReal(1200)).toBe('US$ 1.200')
  })

  it('activo: los montos dentro de texto guardado también se tapan', () => {
    setMontosOcultos(true)
    expect(formatMontosEnTexto('Pago registrado — $ 1.150.000 tarjeta')).toBe(`Pago registrado — ${MONTO_OCULTO} tarjeta`)
    expect(formatMontosEnTexto('Pago editado — $1200000')).toBe(`Pago editado — ${MONTO_OCULTO}`)
    expect(formatMontosEnTexto('Total −US$ 50 y $1,2M')).toBe(`Total ${MONTO_OCULTO} y ${MONTO_OCULTO}`)
    expect(formatMontosEnTexto('Carpa 12 → Carpa 58, comprobante RB-3661')).toBe('Carpa 12 → Carpa 58, comprobante RB-3661')
  })

  it('inactivo: formato de siempre', () => {
    expect(formatMonto(1089000)).toBe('$ 1.089.000')
    expect(formatMontosEnTexto('Pago editado — $1200000')).toBe('Pago editado — $ 1.200.000')
  })
})

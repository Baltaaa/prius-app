import { describe, it, expect } from 'vitest'
import { construirCierreCajaCsv } from './cajaCsv'

// Resumen con la forma real de resumen_caja() (caja del 10/11/2026 en producción:
// facturas y recibos 3.150.000, gastos 900.000, Z N.° 240 por 205.000).
const resumenBase = (z: unknown) => ({
  cabecera: {
    fecha: '2026-11-10', estado: 'cerrada',
    abierta_at: '2026-11-10T12:00:00Z', abierta_por_nombre: 'Balta',
    cerrada_at: '2026-11-10T20:19:00Z', cerrada_por_nombre: 'Balta',
  },
  totales: { ingresos: 3150000, egresos: 900000, neto: 2250000, cantidad: 5 },
  por_medio: [{ medio: 'efectivo', cantidad: 4, ingresos: 3150000, egresos: 900000, neto: 2250000 }],
  arqueo: {
    por_medio: [{ medio: 'efectivo', esperado: 2250000, contado: 2250000, diferencia: 0, declarado: true }],
    total: { esperado: 2250000, contado: 2250000, diferencia: 0 },
  },
  z,
  facturas: [], recibos: [], sin_comprobante: [],
  gastos: { por_categoria: [], detalle: [] },
  anulados: { pagos: [], gastos: [] },
  movimientos: [],
})

const Z = {
  numero: '00000238', fecha: '2026-11-08', total: 340000,
  cantidad_comprobantes: 7, primer_comprobante: '00001208', ultimo_comprobante: '00001214',
}

const meta = { exportadoPorNombre: 'Balta' }

describe('CSV del cierre de caja — Cierre Z (nov 2026)', () => {
  it('la sección de la Z va debajo de los comprobantes del día', () => {
    const csv = construirCierreCajaCsv(resumenBase(Z), meta)
    const iComprobantes = csv.indexOf('COMPROBANTES DEL DÍA')
    const iZ = csv.indexOf('CIERRE Z (CONTROLADOR FISCAL)')
    expect(iComprobantes).toBeGreaterThan(-1)
    expect(iZ).toBeGreaterThan(iComprobantes)
  })

  it('trae las columnas de la Z y el renglón del total del día', () => {
    const csv = construirCierreCajaCsv(resumenBase(Z), meta)
    expect(csv).toContain('N.° de Z;Fecha;Comprobantes;Primero – Último;Total')
    expect(csv).toContain('00000238')
    expect(csv).toContain('00001208 – 00001214')
    expect(csv).toMatch(/Facturas y recibos .* \+ Cierre Z .* = Total del día/)
  })

  it('Ingresos y Neto del resumen incluyen la Z', () => {
    const csv = construirCierreCajaCsv(resumenBase(Z), meta)
    const fila = (c: string) => csv.split('\n').find((l) => l.startsWith(`${c};`))
    expect(fila('Facturas y recibos')).toContain('3150000')
    expect(fila('Ingresos')).toContain('3490000')  // 3.150.000 + 340.000
    expect(fila('Neto')).toContain('2590000')      // 3.490.000 − 900.000
  })

  it('sin Z no se exporta la sección y el total es solo facturas y recibos', () => {
    const csv = construirCierreCajaCsv(resumenBase({ numero: null, total: null }), meta)
    expect(csv).not.toContain('CIERRE Z')
    expect(csv.split('\n').find((l) => l.startsWith('Ingresos;'))).toContain('3150000')
  })

  it('no exporta Neto gravado, IVA ni diferencia vs. registrado', () => {
    const csv = construirCierreCajaCsv(resumenBase(Z), meta)
    for (const prohibido of ['Neto gravado', 'IVA', 'vs. registrado', 'vs registrado']) {
      expect(csv).not.toContain(prohibido)
    }
  })
})

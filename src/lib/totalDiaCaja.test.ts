import { describe, it, expect } from 'vitest'
import { componerTotalDia, tieneZ, montoZ, totalDiaResumen, totalDiaCaja } from './totalDiaCaja'

// Z de ejemplo real (08/11/2026): N.° 00000238, P.V. 00005, 7 comprobantes
// (00001208 a 00001214), total 340000.00.
const Z_EJEMPLO = {
  numero: '00000238',
  fecha: '2026-11-08',
  total: 340000,
  cantidad_comprobantes: 7,
  primer_comprobante: '00001208',
  ultimo_comprobante: '00001214',
}

const resumen = (z: unknown, ingresos = 500000, egresos = 120000) => ({
  totales: { ingresos, egresos, neto: ingresos - egresos, cantidad: 9 },
  z,
})

describe('componerTotalDia', () => {
  it('suma facturas y recibos con el total de la Z', () => {
    expect(componerTotalDia(500000, 340000)).toEqual({ facturasYRecibos: 500000, z: 340000, total: 840000 })
  })

  it('tolera null, undefined y strings de la base', () => {
    expect(componerTotalDia(null, undefined)).toEqual({ facturasYRecibos: 0, z: 0, total: 0 })
    expect(componerTotalDia('500000', '340000.50').total).toBe(840000.5)
  })
})

describe('tieneZ', () => {
  it('reconoce la Z de un resumen y la de una fila de caja_diaria', () => {
    expect(tieneZ(resumen(Z_EJEMPLO))).toBe(true)
    expect(tieneZ({ z_numero: '00000238', z_total: 340000 })).toBe(true)
  })

  it('es false si la caja se cerró sin Z', () => {
    expect(tieneZ(resumen({ numero: null, total: null }))).toBe(false)
    expect(tieneZ(resumen(null))).toBe(false)
    expect(tieneZ({ z_numero: null })).toBe(false)
    expect(tieneZ(null)).toBe(false)
  })

  it('un N.° en blanco sin total no cuenta como Z cargada', () => {
    expect(tieneZ({ z_numero: '   ' })).toBe(false)
    expect(tieneZ({ z_numero: '', z_total: 0 })).toBe(false)
  })

  it('con total pero sin N.° tipeado SÍ cuenta (caso real del 08/11/2026)', () => {
    expect(tieneZ({ z_numero: null, z_total: 340000, z_cantidad_comprobantes: 7 })).toBe(true)
    expect(montoZ({ z_numero: null, z_total: 340000 })).toBe(340000)
  })
})

describe('montoZ', () => {
  it('conserva los centavos de la Z', () => {
    expect(montoZ(resumen({ ...Z_EJEMPLO, total: 340000.75 }))).toBe(340000.75)
  })

  it('es 0 cuando no hay ni N.° ni total', () => {
    expect(montoZ({ z_numero: null, z_total: null })).toBe(0)
    expect(montoZ({ z_numero: '', z_total: 0 })).toBe(0)
  })
})

describe('totalDiaResumen', () => {
  it('ingresos y neto incluyen la Z', () => {
    const d = totalDiaResumen(resumen(Z_EJEMPLO))
    expect(d.facturasYRecibos).toBe(500000)
    expect(d.z).toBe(340000)
    expect(d.total).toBe(840000)
    expect(d.ingresos).toBe(840000)
    expect(d.egresos).toBe(120000)
    expect(d.neto).toBe(720000)
    expect(d.conZ).toBe(true)
  })

  it('sin Z el total es solo facturas y recibos', () => {
    const d = totalDiaResumen(resumen(null))
    expect(d.total).toBe(500000)
    expect(d.ingresos).toBe(500000)
    expect(d.neto).toBe(380000)
    expect(d.conZ).toBe(false)
  })

  it('no lee ninguna diferencia vs. registrado: la Z nunca resta', () => {
    // Z muy chica contra lo registrado: antes daba una "diferencia" negativa;
    // ahora simplemente suma.
    const d = totalDiaResumen(resumen({ ...Z_EJEMPLO, total: 1 }))
    expect(d.total).toBe(500001)
  })
})

describe('totalDiaCaja (fila de caja_diaria)', () => {
  it('historial: total_neto + Z', () => {
    expect(totalDiaCaja({ total_neto: 380000, z_numero: '00000238', z_total: 340000 })).toBe(720000)
  })

  it('sidebar: total_cobros + Z', () => {
    expect(totalDiaCaja({ total_cobros: 500000, z_numero: '00000238', z_total: 340000 }, 'total_cobros')).toBe(840000)
  })

  it('caja sin Z y caja inexistente', () => {
    expect(totalDiaCaja({ total_neto: 380000 })).toBe(380000)
    expect(totalDiaCaja(null, 'total_cobros')).toBe(0)
  })
})

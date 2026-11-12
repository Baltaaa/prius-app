import { describe, it, expect } from 'vitest'
import { montoTipeado, montoPegado, montoDisplay } from './monto'

// Simula tipear carácter por carácter en el input (lo que hace MoneyInput en
// cada onChange): el display que vuelve es lo que el usuario ve en pantalla.
function tipear(teclas: string) {
  let display = ''
  let valor: number | null = null
  for (const t of teclas) {
    const r = montoTipeado(display + t)
    display = r.display
    valor = r.valor
  }
  return { display, valor }
}

describe('montoTipeado — formato argentino en vivo', () => {
  it('pone solo los puntos de miles', () => {
    expect(tipear('3150000')).toEqual({ display: '3.150.000', valor: 3150000 })
  })

  it('la tecla punto no crea decimales (bug del Total Z: "3.150" daba 3,15)', () => {
    expect(tipear('3.150.000')).toEqual({ display: '3.150.000', valor: 3150000 })
    expect(tipear('3.150')).toEqual({ display: '3.150', valor: 3150 })
  })

  it('la coma habilita hasta dos decimales', () => {
    expect(tipear('340000,50')).toEqual({ display: '340.000,50', valor: 340000.5 })
    expect(tipear('340000,505')).toEqual({ display: '340.000,50', valor: 340000.5 })
  })

  it('no borra los ceros mientras se tipea', () => {
    expect(tipear('340000,0').display).toBe('340.000,0')
    expect(tipear('340000,05')).toEqual({ display: '340.000,05', valor: 340000.05 })
    expect(tipear('100').display).toBe('100')
  })

  it('la coma sola se conserva y vale el entero', () => {
    expect(montoTipeado('340.000,')).toEqual({ display: '340.000,', valor: 340000 })
  })

  it('vacío es null, no 0', () => {
    expect(montoTipeado('')).toEqual({ display: '', valor: null })
    expect(montoTipeado('$')).toEqual({ display: '', valor: null })
  })

  it('bloquea letras y no deja ceros a la izquierda', () => {
    expect(montoTipeado('12a3b')).toEqual({ display: '123', valor: 123 })
    expect(montoTipeado('0012')).toEqual({ display: '12', valor: 12 })
    expect(montoTipeado('0,5')).toEqual({ display: '0,5', valor: 0.5 })
  })

  it('negativos solo si se permiten', () => {
    expect(montoTipeado('-1500', true)).toEqual({ display: '-1.500', valor: -1500 })
    expect(montoTipeado('-1500')).toEqual({ display: '1.500', valor: 1500 })
  })

  it('reformatear un display ya formateado no lo cambia (idempotente)', () => {
    const uno = montoTipeado('3.150.000')
    expect(montoTipeado(uno.display)).toEqual(uno)
  })

  it('borrar en el medio no rompe el número', () => {
    // "3.150.000" sin el "5" -> "310.000"
    expect(montoTipeado('3.10.000')).toEqual({ display: '310.000', valor: 310000 })
  })
})

describe('montoPegado — texto de afuera', () => {
  it('interpreta el formato de la app', () => {
    expect(montoPegado('3.150.000')).toBe(3150000)
    expect(montoPegado('3150000')).toBe(3150000)
    expect(montoPegado('$ 1.089.000,00')).toBe(1089000)
    expect(montoPegado('340.000,50')).toBe(340000.5)
  })

  it('interpreta el punto decimal de la Z impresa', () => {
    expect(montoPegado('340000.00')).toBe(340000)
    expect(montoPegado('340000.5')).toBe(340000.5)
  })

  it('un punto con tres dígitos atrás sigue siendo miles', () => {
    expect(montoPegado('3.150')).toBe(3150)
  })

  it('vacío o basura es null', () => {
    expect(montoPegado('')).toBeNull()
    expect(montoPegado('abc')).toBeNull()
    expect(montoPegado(null)).toBeNull()
  })
})

describe('montoDisplay — número guardado -> texto del input', () => {
  it('muestra centavos solo si los tiene', () => {
    expect(montoDisplay(3150000)).toBe('3.150.000')
    expect(montoDisplay(340000.5)).toBe('340.000,50')
    expect(montoDisplay(340000.05)).toBe('340.000,05')
    expect(montoDisplay(0)).toBe('0')
    expect(montoDisplay(-1500)).toBe('-1.500')
  })

  it('va y vuelve sin perder nada', () => {
    for (const n of [0, 1, 999, 3150000, 340000.5, 340000.05]) {
      expect(montoTipeado(montoDisplay(n)).valor).toBe(n)
    }
  })
})

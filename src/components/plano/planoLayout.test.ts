import { describe, it, expect } from 'vitest'
import { enumerarCarpas, enumerarSombrillas } from './planoLayout'

// Mapeo documentado en CLAUDE.md ("Layout del plano"), reescrito acá de forma
// independiente de planoLayout.js a propósito — así el test detecta un error
// de transcripción en el layout, no solo que el layout sea consistente con
// sigo mismo. Verificado además 1:1 contra unidades.fila/orden real (Tarea 1).
function filaOrdenEsperadoCarpa(numero) {
  if (numero >= 1 && numero <= 25) return { fila: 1, orden: numero }
  if (numero >= 26 && numero <= 50) return { fila: 2, orden: numero - 25 }
  if (numero >= 51 && numero <= 75) return { fila: 3, orden: numero - 50 }
  if (numero >= 76 && numero <= 98) return { fila: 4, orden: numero - 75 }
  if (numero >= 99 && numero <= 121) return { fila: 5, orden: numero - 98 }
  if (numero >= 122 && numero <= 144) return { fila: 6, orden: numero - 121 }
  return null
}

function filaOrdenEsperadoSombrilla(numero) {
  if (numero >= 1 && numero <= 5) return { fila: 7, orden: numero }
  if (numero >= 21 && numero <= 25) return { fila: 7, orden: numero - 21 + 7 }
  if (numero >= 6 && numero <= 10) return { fila: 8, orden: numero - 5 }
  if (numero >= 26 && numero <= 30) return { fila: 8, orden: numero - 26 + 7 }
  if (numero >= 11 && numero <= 15) return { fila: 9, orden: numero - 10 }
  if (numero >= 31 && numero <= 35) return { fila: 9, orden: numero - 31 + 7 }
  if (numero >= 16 && numero <= 20) return { fila: 10, orden: numero - 15 }
  if (numero >= 36 && numero <= 40) return { fila: 10, orden: numero - 36 + 7 }
  return null
}

describe('planoLayout — carpas', () => {
  const carpas = enumerarCarpas()

  it('cubre las 144 carpas sin huecos ni duplicados', () => {
    expect(carpas).toHaveLength(144)
    const numeros = carpas.map((c) => c.numero).sort((a, b) => a - b)
    expect(new Set(numeros).size).toBe(144)
    expect(numeros[0]).toBe(1)
    expect(numeros[143]).toBe(144)
  })

  it('cada carpa coincide con el mapeo fila/orden documentado en CLAUDE.md', () => {
    for (const c of carpas) {
      expect({ fila: c.fila, orden: c.orden }).toEqual(filaOrdenEsperadoCarpa(c.numero))
    }
  })

  it('el lado del número es consistente por fila (números siempre por fuera de los bloques)', () => {
    const porFila = new Map()
    for (const c of carpas) porFila.set(c.fila, (porFila.get(c.fila) || new Set()).add(c.numberSide))
    expect(porFila.get(1)).toEqual(new Set(['left']))
    expect(porFila.get(2)).toEqual(new Set(['left']))
    expect(porFila.get(3)).toEqual(new Set(['right']))
    expect(porFila.get(4)).toEqual(new Set(['left']))
    expect(porFila.get(5)).toEqual(new Set(['right']))
    expect(porFila.get(6)).toEqual(new Set(['right']))
  })
})

describe('planoLayout — sombrillas', () => {
  const sombrillas = enumerarSombrillas()

  it('cubre las 40 sombrillas sin huecos ni duplicados', () => {
    expect(sombrillas).toHaveLength(40)
    const numeros = sombrillas.map((s) => s.numero).sort((a, b) => a - b)
    expect(new Set(numeros).size).toBe(40)
    expect(numeros[0]).toBe(1)
    expect(numeros[39]).toBe(40)
  })

  it('cada sombrilla coincide con el mapeo fila/orden documentado en CLAUDE.md', () => {
    for (const s of sombrillas) {
      expect({ fila: s.fila, orden: s.orden }).toEqual(filaOrdenEsperadoSombrilla(s.numero))
    }
  })
})

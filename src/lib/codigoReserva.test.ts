import { describe, it, expect } from 'vitest'
import { ALFABETO, CODIGO_REGEX, normalizar, esValido, cuerpo, filtrarCuerpo, formatear, esCaracterValido } from './codigoReserva'

describe('codigoReserva', () => {
  it('acepta códigos válidos, con letras y números en cualquier posición', () => {
    expect(esValido('PRIUS-A3X9K2')).toBe(true)
    expect(esValido('PRIUS-779C5Z')).toBe(true) // el código real que existe en la base
    expect(esValido('PRIUS-222222')).toBe(true)
    expect(esValido('PRIUS-ZZZZZZ')).toBe(true)
  })

  it('rechaza los inválidos', () => {
    expect(esValido('PRIUS-A3X9K')).toBe(false) // corto
    expect(esValido('PRIUS-A3X9K0')).toBe(false) // 0 no está en el alfabeto
    expect(esValido('PRIUS-A3X9K1')).toBe(false) // 1 tampoco
    expect(esValido('PRIUS-A3X9KI')).toBe(false) // I no
    expect(esValido('PRIUS-A3X9KO')).toBe(false) // O no
    expect(esValido('PRIUS-A3X9K-')).toBe(false)
    expect(esValido('')).toBe(false)
    expect(esValido(null)).toBe(false)
    expect(esValido(undefined)).toBe(false)
  })

  it('largo de más: no se recorta, es inválido', () => {
    expect(esValido('PRIUS-A3X9K2X')).toBe(false)
    expect(esValido('A3X9K2X9')).toBe(false)
  })

  it('en minúsculas', () => {
    expect(normalizar('prius-a3x9k2')).toBe('PRIUS-A3X9K2')
    expect(esValido('a3x9k2')).toBe(true)
  })

  it('con espacios (sobrantes y en el medio)', () => {
    expect(normalizar('  prius-a3x9k2  ')).toBe('PRIUS-A3X9K2')
    expect(normalizar('A3X 9K2')).toBe('PRIUS-A3X9K2')
    expect(normalizar('PRIUS A3X9K2')).toBe('PRIUS-A3X9K2')
    expect(esValido(' PRIUS - A3X9K2 ')).toBe(true)
  })

  it('pegado con y sin prefijo', () => {
    expect(normalizar('A3X9K2')).toBe('PRIUS-A3X9K2')
    expect(normalizar('PRIUS-A3X9K2')).toBe('PRIUS-A3X9K2')
    expect(normalizar('PRIUSA3X9K2')).toBe('PRIUS-A3X9K2')
    expect(cuerpo('PRIUS-A3X9K2')).toBe('A3X9K2')
    expect(cuerpo('a3x9k2')).toBe('A3X9K2')
  })

  it('desde la URL del QR', () => {
    expect(normalizar('https://priusplayagrande.com.ar/r/PRIUS-A3X9K2')).toBe('PRIUS-A3X9K2')
    expect(normalizar('https://priusplayagrande.com.ar/r/a3x9k2?utm=1#x')).toBe('PRIUS-A3X9K2')
    expect(esValido('https://priusplayagrande.com.ar/r/PRIUS-A3X9K2')).toBe(true)
  })

  it('una URL cualquiera no es un código', () => {
    expect(esValido('https://google.com/')).toBe(false)
    expect(esValido('hola mundo')).toBe(false)
  })

  it('filtrarCuerpo descarta lo que no va y corta en 6', () => {
    expect(filtrarCuerpo('a3x-9k2')).toEqual({ cuerpo: 'A3X9K2', descartados: true })
    expect(filtrarCuerpo('A3X9K2')).toEqual({ cuerpo: 'A3X9K2', descartados: false })
    expect(filtrarCuerpo('A3X9K2XXXX').cuerpo).toBe('A3X9K2')
    expect(filtrarCuerpo('0O1I').cuerpo).toBe('')
    expect(filtrarCuerpo('0O1I').descartados).toBe(true)
    expect(filtrarCuerpo('a3 x').cuerpo).toBe('A3X')
  })

  it('formatear', () => {
    expect(formatear('A3X9K2')).toBe('PRIUS-A3X9K2')
    expect(formatear('')).toBe('')
  })

  it('el alfabeto tiene 32 caracteres y coincide con la regex', () => {
    expect(ALFABETO).toHaveLength(32)
    for (const c of ALFABETO) expect(CODIGO_REGEX.test(`PRIUS-${c.repeat(6)}`)).toBe(true)
    for (const c of '01IO') expect(esCaracterValido(c)).toBe(false)
  })
})

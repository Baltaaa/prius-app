import { describe, it, expect } from 'vitest'
import {
  parsePesos, parseDNI, parseCUIT, parseTelefono, parseFecha,
  normalizarNombre, normalizarEmail, normalizarCodigoReserva, codigoReservaValido, cuitValido, dniValido, parseUnidadQuery,
} from './parse'

describe('parsePesos', () => {
  it('acepta dígitos crudos', () => {
    expect(parsePesos('1089000')).toBe(1089000)
  })
  it('acepta con separador de miles', () => {
    expect(parsePesos('1.089.000')).toBe(1089000)
  })
  it('acepta con signo $ y espacio', () => {
    expect(parsePesos('$ 1.089.000')).toBe(1089000)
  })
  it('descarta ",00" pegado', () => {
    expect(parsePesos('$1.089.000,00')).toBe(1089000)
  })
  it('rechaza centavos reales', () => {
    expect(() => parsePesos('1.089.000,50')).toThrow('centavos')
  })
  it('vacío es null, no 0', () => {
    expect(parsePesos('')).toBeNull()
    expect(parsePesos(null)).toBeNull()
  })
  it('basura pegada no rompe, ignora lo no numérico salvo que quede vacío', () => {
    expect(parsePesos('abc')).toBeNull()
  })
  it('acepta number directo y redondea', () => {
    expect(parsePesos(1500.4)).toBe(1500)
  })
})

describe('parseDNI / parseCUIT', () => {
  it('se queda solo con dígitos', () => {
    expect(parseDNI('30.123.456')).toBe('30123456')
    expect(parseCUIT('20-30123456-7')).toBe('20301234567')
  })
})

describe('parseFecha', () => {
  it('formato válido dd/mm/aaaa', () => {
    expect(parseFecha('30/09/2026')).toBe('2026-09-30')
  })
  it('rechaza 31/02 (no existe)', () => {
    expect(parseFecha('31/02/2026')).toBeNull()
  })
  it('rechaza 29/02 en año no bisiesto', () => {
    expect(parseFecha('29/02/2026')).toBeNull()
  })
  it('acepta 29/02 en año bisiesto', () => {
    expect(parseFecha('29/02/2028')).toBe('2028-02-29')
  })
})

describe('normalizarNombre', () => {
  it('capitaliza y reemplaza acento agudo por apóstrofo recto', () => {
    expect(normalizarNombre('gustavo d´agostino')).toBe("Gustavo D'Agostino")
  })
  it('colapsa espacios múltiples y hace trim', () => {
    expect(normalizarNombre('  juan   perez  ')).toBe('Juan Perez')
  })
  it('partículas en minúscula salvo al inicio', () => {
    expect(normalizarNombre('maria de los angeles')).toBe('Maria de los Angeles')
    expect(normalizarNombre('de la fuente')).toBe('De la Fuente')
  })
})

describe('normalizarEmail / normalizarCodigoReserva', () => {
  it('email trim + lowercase', () => {
    expect(normalizarEmail('  Juan@Mail.COM ')).toBe('juan@mail.com')
  })
  it('código de reserva mayúsculas + prefijo', () => {
    expect(normalizarCodigoReserva('a3x9k2')).toBe('PRIUS-A3X9K2')
    expect(normalizarCodigoReserva('prius-a3x9k2')).toBe('PRIUS-A3X9K2')
  })
})

describe('normalizarCodigoReserva / codigoReservaValido', () => {
  it('acepta la URL completa del QR y extrae el código', () => {
    expect(normalizarCodigoReserva('https://priusplayagrande.com.ar/r/PRIUS-A3X9K2')).toBe('PRIUS-A3X9K2')
  })
  it('acepta la URL en minúsculas', () => {
    expect(normalizarCodigoReserva('https://priusplayagrande.com.ar/r/a3x9k2')).toBe('PRIUS-A3X9K2')
  })
  it('acepta el código sin prefijo', () => {
    expect(normalizarCodigoReserva('a3x9k2')).toBe('PRIUS-A3X9K2')
  })
  it('acepta el código con prefijo y espacios', () => {
    expect(normalizarCodigoReserva('  prius-a3x9k2  ')).toBe('PRIUS-A3X9K2')
  })
  it('vacío o null da string vacío', () => {
    expect(normalizarCodigoReserva('')).toBe('')
    expect(normalizarCodigoReserva(null)).toBe('')
  })
  it('valida el formato contra el alfabeto real (sin 0/O/1/I)', () => {
    expect(codigoReservaValido('PRIUS-A3X9K2')).toBe(true)
    expect(codigoReservaValido('a3x9k2')).toBe(true)
    expect(codigoReservaValido('https://priusplayagrande.com.ar/r/PRIUS-A3X9K2')).toBe(true)
  })
  it('rechaza formato inválido', () => {
    expect(codigoReservaValido('PRIUS-A3X9K')).toBe(false) // corto
    expect(codigoReservaValido('PRIUS-A3X9K0')).toBe(false) // 0 no está en el alfabeto
    expect(codigoReservaValido('PRIUS-A3X9KI')).toBe(false) // I no está en el alfabeto
    expect(codigoReservaValido('')).toBe(false)
  })
})

describe('cuitValido', () => {
  it('CUIT real válido (dígito verificador módulo 11)', () => {
    expect(cuitValido('20-30123456-3')).toBe(true)
  })
  it('rechaza dígito verificador incorrecto', () => {
    expect(cuitValido('20-30123456-8')).toBe(false)
  })
  it('rechaza prefijo inválido', () => {
    expect(cuitValido('99-30123456-7')).toBe(false)
  })
  it('rechaza longitud incorrecta', () => {
    expect(cuitValido('123')).toBe(false)
  })
})

describe('dniValido', () => {
  it('acepta 7 u 8 dígitos en rango', () => {
    expect(dniValido('30123456')).toBe(true)
    expect(dniValido('5123456')).toBe(true)
  })
  it('rechaza fuera de rango o longitud', () => {
    expect(dniValido('123')).toBe(false)
    expect(dniValido('999999999')).toBe(false)
  })
})

describe('parseUnidadQuery', () => {
  it('solo número: cualquier tipo', () => {
    expect(parseUnidadQuery('19')).toEqual({ tipo: null, numero: 19 })
  })
  it('nombre completo + número', () => {
    expect(parseUnidadQuery('carpa 19')).toEqual({ tipo: 'carpa', numero: 19 })
  })
  it('abreviatura con punto', () => {
    expect(parseUnidadQuery('c.19')).toEqual({ tipo: 'carpa', numero: 19 })
  })
  it('abreviatura pegada', () => {
    expect(parseUnidadQuery('s4')).toEqual({ tipo: 'sombrilla', numero: 4 })
  })
  it('texto sin número no matchea', () => {
    expect(parseUnidadQuery('juan perez')).toBeNull()
  })
})

describe('parseTelefono', () => {
  it('normaliza 0 y 15 característicos de AR a E.164', () => {
    expect(parseTelefono('0223 15 512-3456')).toBe('+5492235123456')
  })
  it('acepta ya en E.164', () => {
    expect(parseTelefono('+5492235123456')).toBe('+5492235123456')
  })
  it('inválido devuelve null', () => {
    expect(parseTelefono('123')).toBeNull()
  })
})

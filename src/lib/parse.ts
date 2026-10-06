// Única fuente de verdad para PARSEAR lo que el usuario escribe o pega, y
// para normalizar texto antes de guardar (Tarea 1). Tolerante con el input
// (espacios, puntos, comas, mayúsculas sueltas), estricto con el resultado:
// o devuelve un valor limpio, o `null`/lanza con un mensaje en español listo
// para mostrar inline. Ver src/lib/format.ts para el sentido inverso.
//
// Ejemplo: parsePesos("$ 1.089.000") -> 1089000; parsePesos("1089000,50") -> throw.

import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js/min'

/**
 * Acepta "1089000", "1.089.000", "$ 1.089.000", "$1.089.000,00" (descarta
 * ",00"), con espacios sueltos. Convención AR: punto = miles, coma = decimal.
 * Si hay decimales distintos de "00" tira un error legible. Vacío -> null
 * (nunca 0: "no se cargó nada" es un estado distinto de "se cargó $0").
 */
export function parsePesos(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null
  const s = raw.trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!s) return null

  const conComaDecimal = /,\d{1,2}$/.test(s)
  if (conComaDecimal) {
    const [entero, decimales] = s.split(',')
    if (decimales !== '00' && decimales !== '0') {
      throw new Error('Ingresá el monto sin centavos')
    }
    const limpio = entero.replace(/\./g, '').replace(/[^\d-]/g, '')
    const n = Number(limpio)
    return Number.isFinite(n) ? n : null
  }

  const limpio = s.replace(/\./g, '').replace(/[^\d-]/g, '')
  if (!limpio || limpio === '-') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** Solo dígitos, sin puntos ni guiones. */
export function parseDNI(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

/** Solo dígitos, sin guiones. */
export function parseCUIT(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * Acepta "223 5123456", "0223 15 5123456", "+54 9 223 512-3456"; normaliza
 * el 0 y el 15 característicos de Argentina. Devuelve E.164 o null si no es
 * un número válido.
 */
export function parseTelefono(raw: string | null | undefined, defaultCountry: 'AR' | string = 'AR'): string | null {
  if (!raw) return null
  const limpio = raw.trim()
  if (!limpio) return null
  try {
    if (!isValidPhoneNumber(limpio, defaultCountry as any)) return null
    const phone = parsePhoneNumberFromString(limpio, defaultCountry as any)
    return phone ? phone.number : null
  } catch {
    return null
  }
}

const MESES_31 = new Set([1, 3, 5, 7, 8, 10, 12])

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

/** "dd/mm/aaaa" estricto — rechaza fechas inexistentes (31/02, 29/02 en año no bisiesto). Devuelve "yyyy-mm-dd" o null. */
export function parseFecha(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  const anio = Number(m[3])
  if (mes < 1 || mes > 12) return null
  const diasEnMes = mes === 2 ? (esBisiesto(anio) ? 29 : 28) : MESES_31.has(mes) ? 31 : 30
  if (dia < 1 || dia > diasEnMes) return null
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

/** Trim + colapsa espacios + ´/` -> ' + capitaliza respetando partículas (salvo al inicio). "gustavo d´agostino" -> "Gustavo D'Agostino". */
export function normalizarNombre(raw: string | null | undefined): string {
  const limpio = String(raw ?? '').trim().replace(/\s+/g, ' ').replace(/[´`]/g, "'")
  if (!limpio) return ''
  return limpio
    .split(' ')
    .map((palabra, i) => {
      const partes = palabra.split("'")
      const capitalizada = partes
        .map((p, pi) => {
          if (!p) return p
          const lower = p.toLocaleLowerCase('es-AR')
          if (pi === 0 && i > 0 && PARTICULAS.has(lower)) return lower
          return lower.charAt(0).toLocaleUpperCase('es-AR') + lower.slice(1)
        })
        .join("'")
      return capitalizada
    })
    .join(' ')
}

export function normalizarEmail(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

// Formato razonable de email (no RFC 5322 completo, alcanza para frenar
// "123456" o "asd" en el campo) — algo@algo.dominio, sin espacios.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailValido(raw: string | null | undefined): boolean {
  const email = normalizarEmail(raw)
  return email.length === 0 || EMAIL_REGEX.test(email)
}

/** Mayúsculas, sin espacios, agrega "PRIUS-" si falta. */
export function normalizarCodigoReserva(raw: string | null | undefined): string {
  const limpio = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!limpio) return ''
  return limpio.startsWith('PRIUS-') ? limpio : `PRIUS-${limpio}`
}

/**
 * Normaliza un número de comprobante para buscarlo sin importar cómo se
 * tipeó: saca todo lo que no sea dígito (guiones, espacios) y los ceros a
 * la izquierda — "1234", "0001-00001234" y "00001234" terminan en el mismo
 * "1234" (Tarea 3, buscador de Clientes por factura/comprobante).
 */
export function normalizarNumeroComprobante(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

const CUIT_PREFIJOS_VALIDOS = new Set([20, 23, 24, 25, 26, 27, 30, 33, 34])

/** Dígito verificador módulo 11 + prefijo válido (20/23/24/25/26/27/30/33/34). */
export function cuitValido(raw: string | null | undefined): boolean {
  const digits = parseCUIT(raw)
  if (digits.length !== 11) return false
  const prefijo = Number(digits.slice(0, 2))
  if (!CUIT_PREFIJOS_VALIDOS.has(prefijo)) return false

  const coeficientes = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = coeficientes.reduce((acc, c, i) => acc + c * Number(digits[i]), 0)
  const resto = suma % 11
  const verificadorEsperado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto
  return verificadorEsperado === Number(digits[10])
}

const UNIDAD_ALIAS: Record<string, string> = {
  carpa: 'carpa', c: 'carpa',
  sombrilla: 'sombrilla', s: 'sombrilla',
  cabina: 'cabina', cb: 'cabina',
  locker: 'locker', l: 'locker',
}

/**
 * Interpreta lo que alguien tipea en el buscador para encontrar una unidad:
 * "19" (cualquier tipo), "carpa 19", "c.19", "c19", "c 19" (tipo puntual).
 * Devuelve `{ tipo: 'carpa'|null, numero: 19 }` o `null` si no hay ningún
 * número reconocible (para no gastar un match de búsqueda en texto que no
 * tiene pinta de unidad).
 */
export function parseUnidadQuery(raw: string | null | undefined): { tipo: string | null; numero: number } | null {
  const q = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return null

  // "c.19" / "c19" / "c 19" / "carpa 19" — letras al inicio + número.
  const conPrefijo = q.match(/^([a-záéíóúñ]+)\.?\s*(\d+)$/i)
  if (conPrefijo) {
    const alias = UNIDAD_ALIAS[conPrefijo[1]]
    if (alias) return { tipo: alias, numero: Number(conPrefijo[2]) }
  }

  // Solo dígitos: cualquier tipo.
  if (/^\d+$/.test(q)) return { tipo: null, numero: Number(q) }

  return null
}

/** 7 u 8 dígitos, entre 1.000.000 y 99.999.999. */
export function dniValido(raw: string | null | undefined): boolean {
  const digits = parseDNI(raw)
  if (digits.length < 7 || digits.length > 8) return false
  const n = Number(digits)
  return n >= 1_000_000 && n <= 99_999_999
}

// Única fuente del formato de código de reserva ("PRIUS-A3X9K2"). Todo input
// de código (Recepción, lector USB, resultado del QR, eventos remotos) pasa por
// acá; nunca se vuelve a escribir la regex suelta.
//
// El formato sale de generar_codigo_reserva() en Postgres: "PRIUS-" más 6
// caracteres elegidos cada uno de forma independiente del alfabeto de 32
// (A–Z sin I ni O, y dígitos 2–9; sin 0 ni 1 para no confundir al leer o
// tipear). NO hay posiciones fijas de letra o número: PRIUS-779C5Z es válido.
// consultar-reserva (Edge Function) valida la misma regex del lado servidor.
export const PREFIJO = 'PRIUS-'
export const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LARGO = 6
export const CODIGO_REGEX = /^PRIUS-[A-HJ-NP-Z2-9]{6}$/

/** Un solo carácter del cuerpo: mayúscula del alfabeto. */
export const esCaracterValido = (c) => ALFABETO.includes(String(c).toUpperCase()) && String(c).length === 1

/**
 * Lleva lo que haya (tipeado, pegado, leído por el lector o la URL del QR
 * https://…/r/PRIUS-XXXXXX) a la forma "PRIUS-XXXXXX": mayúsculas, sin espacios
 * ni query, y con el prefijo si faltaba. No valida: eso es `esValido`.
 */
export function normalizar(raw) {
  let limpio = String(raw ?? '').trim()
  if (!limpio) return ''
  // URL: el código es el último segmento del path, sin query ni hash.
  limpio = limpio.split(/[?#]/)[0]
  const partes = limpio.split('/').filter(Boolean)
  if (partes.length > 1 || /^https?:/i.test(limpio)) limpio = partes[partes.length - 1] || limpio
  limpio = limpio.toUpperCase().replace(/\s+/g, '')
  if (!limpio) return ''
  // El cuerpo nunca empieza con "PRIUS" (la I no está en el alfabeto), así que
  // sacar el prefijo —con guion o sin él— no puede comerse un código válido.
  return PREFIJO + limpio.replace(/^PRIUS[-_]?/, '')
}

export const esValido = (raw) => CODIGO_REGEX.test(normalizar(raw))

/** Los 6 caracteres del cuerpo ("A3X9K2"), o '' si no hay. */
export function cuerpo(raw) {
  const n = normalizar(raw)
  return n.startsWith(PREFIJO) ? n.slice(PREFIJO.length) : ''
}

/**
 * Para el input mientras se tipea: deja solo los caracteres del alfabeto, en
 * mayúsculas y hasta el largo del código. `descartados` avisa si se tiró algo.
 */
export function filtrarCuerpo(raw) {
  const mayus = String(raw ?? '').toUpperCase().replace(/\s+/g, '')
  const validos = [...mayus].filter(esCaracterValido)
  return { cuerpo: validos.slice(0, LARGO).join(''), descartados: validos.length !== mayus.length }
}

/** "PRIUS-A3X9K2" a partir del cuerpo (o de un código ya completo). */
export const formatear = (cuerpoOCodigo) => {
  const n = normalizar(cuerpoOCodigo)
  return n === PREFIJO ? '' : n
}

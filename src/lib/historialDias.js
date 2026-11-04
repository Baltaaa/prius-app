import { fechaAR, hoyAR, sumarDias } from './fechas'
import { formatFechaLarga } from './format'

// Día calendario de un evento del Historial, SIEMPRE en America/Argentina/
// Buenos_Aires. `eventos.fecha_ref` se calcula en UTC en la base: un evento de
// las 22:23 del martes (01:23 UTC del miércoles) quedaba bajo "Hoy". El día sale
// del instante real (`ts`); `fecha_ref` solo es respaldo si no hay `ts`.
export const diaDeEvento = (evento) => fechaAR(evento?.ts) || evento?.fecha_ref || null

// Agrupa por día: días de más nuevo a más viejo y "sin-fecha" al final. Dentro
// de cada día conserva el orden recibido (la consulta ya viene por ts desc).
export function agruparPorDia(eventos) {
  const map = new Map()
  for (const e of eventos || []) {
    const key = diaDeEvento(e) || 'sin-fecha'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  const entradas = [...map.entries()]
  const conFecha = entradas.filter(([k]) => k !== 'sin-fecha').sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const sinFecha = entradas.filter(([k]) => k === 'sin-fecha')
  return [...conFecha, ...sinFecha]
}

// Argentina no usa horario de verano desde 2009: el offset es fijo (-03:00).
const OFFSET = '-03:00'

// Límites de un rango de días ("YYYY-MM-DD", inclusivo) como instantes: de las
// 00:00 del primer día a las 23:59:59.999 del último, hora de Buenos Aires.
export function limitesDeRango(desde, hasta) {
  return {
    desde: desde ? `${desde}T00:00:00.000${OFFSET}` : null,
    hasta: hasta ? `${hasta}T23:59:59.999${OFFSET}` : null,
  }
}

export { sumarDias }

export function etiquetaDia(dia, hoy = hoyAR()) {
  if (dia === 'sin-fecha') return 'Sin fecha'
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  return formatFechaLarga(dia)
}

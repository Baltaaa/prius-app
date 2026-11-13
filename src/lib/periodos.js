// Períodos de Reportes (nov 2026): de una vista ("Mes") y un ancla a un
// rango concreto de fechas, y de ahí a la etiqueta que se muestra.
//
// Todo día es día argentino: las fechas son strings 'YYYY-MM-DD' y la
// aritmética no pasa nunca por toISOString (ver lib/fechas.js y la regla de
// lint que lo prohíbe).

import { hoyAR, sumarDias, sumarMeses } from './fechas'

export const VISTAS = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'temporada', label: 'Temporada' },
  { value: 'anio', label: 'Año' },
  { value: 'rango', label: 'Rango' },
]

const pad = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' -> partes numéricas, sin construir un Date con huso. */
function partes(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

const arma = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** Último día del mes `m` del año `y`. */
function ultimoDiaMes(y, m) {
  return new Date(y, m, 0).getDate()
}

/** Lunes de la semana de `iso` (la semana arranca lunes, como el resto de la app). */
export function lunesDe(iso) {
  const { y, m, d } = partes(iso)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7 // 0 = lunes
  return sumarDias(iso, -dow)
}

/**
 * Rango de la vista, anclado en `ancla` (una fecha cualquiera dentro del
 * período). `temporada` es la fila de temporadas vigente (puede faltar);
 * `rango` es el rango elegido a mano, que solo usa la vista 'rango'.
 */
export function rangoDe(vista, ancla, { temporada, rango } = {}) {
  const { y, m } = partes(ancla)
  switch (vista) {
    case 'dia':
      return { desde: ancla, hasta: ancla }
    case 'semana': {
      const lunes = lunesDe(ancla)
      return { desde: lunes, hasta: sumarDias(lunes, 6) }
    }
    case 'mes':
      return { desde: arma(y, m, 1), hasta: arma(y, m, ultimoDiaMes(y, m)) }
    case 'anio':
      return { desde: arma(y, 1, 1), hasta: arma(y, 12, 31) }
    case 'temporada':
      // Sin temporada cargada no se inventan fechas: cae en el año del ancla.
      if (!temporada?.fecha_inicio || !temporada?.fecha_fin) {
        return { desde: arma(y, 1, 1), hasta: arma(y, 12, 31) }
      }
      return { desde: temporada.fecha_inicio, hasta: temporada.fecha_fin }
    case 'rango':
    default:
      return { desde: rango?.desde || hoyAR(), hasta: rango?.hasta || hoyAR() }
  }
}

/**
 * Corre el ancla un período para atrás (-1) o para adelante (+1). Las vistas
 * 'temporada' y 'rango' no se navegan con flechas (la temporada es una, y el
 * rango se elige a mano), así que devuelven el ancla tal cual.
 */
export function navegar(vista, ancla, dir) {
  switch (vista) {
    case 'dia': return sumarDias(ancla, dir)
    case 'semana': return sumarDias(ancla, 7 * dir)
    case 'mes': return sumarMeses(ancla, dir)
    case 'anio': return sumarMeses(ancla, 12 * dir)
    default: return ancla
  }
}

/** ¿La vista se puede navegar con las flechas / el swipe? */
export function navegable(vista) {
  return vista === 'dia' || vista === 'semana' || vista === 'mes' || vista === 'anio'
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Etiqueta del período para el navegador ‹ período ›. Corta y sin truncar:
 * "Hoy", "Jue 13/11", "09/11 al 15/11", "Noviembre 2026", "2026",
 * "Temporada 2026/2027".
 */
export function etiquetaPeriodo(vista, ancla, { temporada, rango } = {}) {
  const { desde, hasta } = rangoDe(vista, ancla, { temporada, rango })
  const hoy = hoyAR()
  switch (vista) {
    case 'dia': {
      if (desde === hoy) return 'Hoy'
      if (desde === sumarDias(hoy, -1)) return 'Ayer'
      const { y, m, d } = partes(desde)
      const dia = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' })
      return `${capitalizar(dia.replace('.', ''))} ${pad(d)}/${pad(m)}`
    }
    case 'semana': {
      const a = partes(desde), b = partes(hasta)
      return `${pad(a.d)}/${pad(a.m)} al ${pad(b.d)}/${pad(b.m)}`
    }
    case 'mes': {
      const { y, m } = partes(desde)
      return `${capitalizar(MESES[m - 1])} ${y}`
    }
    case 'anio':
      return String(partes(desde).y)
    case 'temporada':
      return temporada?.nombre ? `Temporada ${temporada.nombre}` : 'Temporada'
    case 'rango':
    default: {
      const a = partes(desde), b = partes(hasta)
      return `${pad(a.d)}/${pad(a.m)}/${String(a.y).slice(2)} – ${pad(b.d)}/${pad(b.m)}/${String(b.y).slice(2)}`
    }
  }
}

/**
 * Etiqueta de un bucket de la serie que devuelve `reporte_resumen`, según la
 * granularidad que eligió la base ('dia' | 'semana' | 'mes').
 */
export function etiquetaBucket(bucketIso, granularidad) {
  const { y, m, d } = partes(bucketIso)
  if (granularidad === 'mes') return `${capitalizar(MESES[m - 1]).slice(0, 3)} ${String(y).slice(2)}`
  if (granularidad === 'semana') return `${pad(d)}/${pad(m)}`
  return `${pad(d)}/${pad(m)}`
}

/** "Promedio diario / semanal / mensual" (nunca "Promedio por mensual"). */
export const PROMEDIO_LABEL = {
  dia: 'Promedio diario',
  semana: 'Promedio semanal',
  mes: 'Promedio mensual',
  anio: 'Promedio anual',
  temporada: 'Promedio diario',
  rango: 'Promedio diario',
}

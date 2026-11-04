// Única fuente del "día" de la app: SIEMPRE hora argentina (America/Argentina/
// Buenos_Aires), nunca UTC ni la zona del navegador. Pasadas las 21:00 ART un
// `toISOString()` ya devuelve el día siguiente; el día cambia a las 00:00 ART.
// Formato "YYYY-MM-DD", igual al de las columnas `date`. Un lint
// (`no-restricted-syntax` en eslint.config.js) prohíbe
// `toISOString().split/slice/substring` en el resto del código.
const ZONA = 'America/Argentina/Buenos_Aires'

export const fechaAR = (valor) => {
  if (!valor) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

export const hoyAR = () => fechaAR(new Date())

const pad = (n) => String(n).padStart(2, '0')
const aTexto = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
const aFecha = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

// Aritmética de calendario sobre "YYYY-MM-DD" (sin zonas horarias de por medio).
export function sumarDias(fecha, n) {
  const dt = aFecha(fecha)
  dt.setUTCDate(dt.getUTCDate() + n)
  return aTexto(dt)
}
export function sumarMeses(fecha, n) {
  const dt = aFecha(fecha)
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return aTexto(dt)
}

// Milisegundos hasta las 00:00 ART siguientes (Argentina no tiene horario de
// verano: 00:00 ART = 03:00 UTC). Para refrescar "hoy" justo al cambiar el día.
export function msHastaMedianocheAR(ahora = Date.now()) {
  const d = new Date(ahora)
  const prox = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 0, 0, 0)
  return (prox > ahora ? prox : prox + 86400000) - ahora
}

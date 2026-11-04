// Fechas en hora de Argentina (la del balneario), sin depender de la zona del
// navegador ni del UTC: pasadas las 21:00 un `toISOString()` ya devuelve el día
// siguiente. Formato "YYYY-MM-DD", igual al de las columnas `date`.
const ZONA = 'America/Argentina/Buenos_Aires'

export const fechaAR = (valor) => {
  if (!valor) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

export const hoyAR = () => fechaAR(new Date())

// Resumen compacto de un día de clima para el chip: una hora "representativa"
// (la actual si estamos mirando hoy, el mediodía si no) + los picos de viento/
// ráfaga del día completo — la alerta de "viento fuerte" mira el pico del
// día, no solo la hora puntual, para no subestimar una ráfaga que ya pasó o
// todavía no llegó.
export function resumenDiaClima(clima) {
  if (!clima?.disponible || !clima.horas?.length) return null
  const horas = clima.horas
  const horaActual = `${String(new Date().getHours()).padStart(2, '0')}:00`
  const actual = horas.find((h) => h.hora === horaActual) || horas.find((h) => h.hora === '13:00') || horas[Math.floor(horas.length / 2)]
  const rafagaMax = Math.max(...horas.map((h) => Number(h.rafaga) || 0))
  const vientoMax = Math.max(...horas.map((h) => Number(h.viento) || 0))
  return { actual, rafagaMax, vientoMax }
}

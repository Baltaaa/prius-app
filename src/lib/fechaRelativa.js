import { formatFecha } from './format'

// "hace 5 min", "hace 3 h", "ayer", "hace 4 d" y, pasada una semana, la fecha.
export function fechaRelativa(valor, ahora = Date.now()) {
  const t = new Date(valor).getTime()
  if (!valor || Number.isNaN(t)) return ''
  const min = Math.max(0, Math.round((ahora - t) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} d`
  return formatFecha(valor)
}

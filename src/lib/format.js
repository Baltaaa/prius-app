// Formatters a nivel de módulo: se crean UNA vez para toda la app.
// Antes cada página hacía `new Intl.NumberFormat(...)` dentro del componente,
// re-creándolo por celda y por render (cientos de objetos por tecla en el buscador).

const currencyFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const dateFmt = new Intl.DateTimeFormat('es-AR')
const FECHA_SOLO_RE = /^\d{4}-\d{2}-\d{2}$/

export const formatCurrency = (val) => currencyFmt.format(Number(val) || 0)

// Nunca mostrar "$ 0" (sep 2026): un monto en cero es visualmente idéntico a
// "no se cargó nada" cuando en realidad significa "no hay deuda" (reserva
// pagada/saldada) o "sin cargo" (bonificada) — dos cosas muy distintas que
// terminaban mostrando el mismo texto engañoso. Devuelve el monto formateado
// SOLO si es mayor a 0; `null` en cualquier otro caso (0, null, undefined)
// para que el llamador no renderice nada ahí. No usar en Caja/Reportes,
// donde un total en $0 sí es un dato real del día/período.
export const formatMontoVisible = (val) => {
  const n = Number(val)
  return n > 0 ? currencyFmt.format(n) : null
}

// Normaliza para comparar sin importar mayúsculas/acentos (ej: "Perez" matchea
// "Pérez"). Único lugar con esta lógica — antes vivía duplicada en TopBar.jsx.
export const normalizeText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

// Único lugar con el mapeo tipo de unidad -> emoji, para que "carpa" y
// "sombrilla" se vean igual en todas las pantallas (Reservas, Clientes,
// Comprobantes, Calendario, Reportes, PagoModal, notificaciones, plano).
// ⛱️ (U+26F1, "umbrella on ground") se pintaba como una bola naranja a tamaño
// chico en varias plataformas — se confundía con un tomate (reportado en
// auditoría sep 2026). 🏖️ (beach with umbrella) es más grande/reconocible.
const UNIDAD_EMOJI = { carpa: '🏠', sombrilla: '🏖️' }
export const unidadEmoji = (tipo) => UNIDAD_EMOJI[tipo] || ''

// `new Date('2027-01-15')` parsea como medianoche UTC — en un huso horario
// detrás de UTC (Argentina, UTC-3) el formateo local corre la fecha un día
// para atrás (mostraba 14/1/2027 para una reserva guardada como 15/1/2027).
// Las columnas `date` de Postgres (fecha, fecha_inicio, fecha_fin) llegan
// como "yyyy-mm-dd" puro: se arman como fecha LOCAL a mano para no perder el
// día. `created_at` sigue siendo timestamptz y pasa por new Date() normal.
// dd/mm o dd/mm/aa a partir de una columna `date` "yyyy-mm-dd" pura — usado
// en la hoja A4 del plano (PlanoImpresion), donde el listado de carperos
// necesita el formato corto "del dd/mm al dd/mm/aa", no el largo de formatDate.
export const formatFechaCorta = (val, withYear = false) => {
  if (!val || !FECHA_SOLO_RE.test(val)) return ''
  const [y, m, d] = val.split('-')
  return withYear ? `${d}/${m}/${y.slice(2)}` : `${d}/${m}`
}

export const formatDate = (val) => {
  if (!val) return 'N/A'
  if (FECHA_SOLO_RE.test(val)) {
    const [y, m, d] = val.split('-').map(Number)
    return dateFmt.format(new Date(y, m - 1, d))
  }
  return dateFmt.format(new Date(val))
}

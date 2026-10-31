// Única fuente de verdad para MOSTRAR datos en toda la app (Tarea 1, guía
// "Inputs, validación y formateo unificado"). Prohibido formatear a mano en
// componentes — importar siempre de acá. Ver src/lib/parse.ts para el
// sentido inverso (texto del usuario -> valor) y src/lib/validators/ para
// zod. Zona horaria SIEMPRE America/Argentina/Buenos_Aires, nunca la del
// navegador (un cajero en otro huso horario no puede correr la fecha de un
// movimiento de caja).
//
// Ejemplo: formatPesos(1089000) -> "$ 1.089.000"; formatPesos(-15000) -> "−$ 15.000".

import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

const TZ = 'America/Argentina/Buenos_Aires'
const MINUS = '−' // signo menos real (U+2212), no el guion ASCII "-"

const pesosFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const dateLargaFmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})
const mesAnioFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, month: 'long', year: 'numeric' })

// Node/ICU en algunas combinaciones "day:2-digit, month:2-digit" sueltas
// (sin date style completo) resuelve silenciosamente a "numeric" y pierde el
// cero adelante (09 -> "9"); y "hour:2-digit" en es-AR usa 12h con "p. m."
// por default. Para no depender de esos detalles de locale, se extraen los
// componentes numéricos en la zona AR con formatToParts y se arma el string
// a mano con padStart — mismo resultado en cualquier entorno/Node/browser.
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

function partesAR(f: Date): { anio: number; mes: number; dia: number; hora: number; minuto: number } {
  const partes: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(f)) partes[p.type] = p.value
  // hour12:false en algunos motores devuelve "24" a medianoche en vez de "00".
  const hora = partes.hour === '24' ? 0 : Number(partes.hour)
  return { anio: Number(partes.year), mes: Number(partes.month), dia: Number(partes.day), hora, minuto: Number(partes.minute) }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const FECHA_SOLO_RE = /^\d{4}-\d{2}-\d{2}$/

// Columnas `date` de Postgres llegan "yyyy-mm-dd" puras (sin hora): hay que
// armarlas como mediodía UTC antes de pasarlas a un DateTimeFormat con
// timeZone AR — si se arman a medianoche UTC, AR (UTC-3) las corre un día
// para atrás. `created_at`/`fecha_hora` (timestamptz) ya vienen con offset
// real y se pasan tal cual.
function aFechaSegura(val: string | Date | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (FECHA_SOLO_RE.test(val)) return new Date(`${val}T12:00:00Z`)
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "$ 1.089.000" / "−$ 15.000" / "$ 0". Entero, sin centavos — decisión única de la app. */
export function formatPesos(n: number | null | undefined): string {
  const num = Number(n) || 0
  const abs = Math.round(Math.abs(num))
  return num < 0 ? `${MINUS}$ ${pesosFmt.format(abs)}` : `$ ${pesosFmt.format(abs)}`
}

/** Igual a formatPesos, pero null/undefined -> null (el llamador no renderiza nada). Reemplaza el viejo formatMontoVisible. */
export function formatPesosVisible(n: number | null | undefined): string | null {
  return Number(n) > 0 ? formatPesos(n) : null
}

/** "$1,2M" / "$850K" / "$ 500" — versión abreviada para espacios chicos (stats compactas del Plano mobile). Por debajo de 1000 cae a formatPesos entero. */
export function formatPesosCompacto(n: number | null | undefined): string {
  const num = Number(n) || 0
  const abs = Math.abs(num)
  const signo = num < 0 ? MINUS : ''
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000)}K`
  return formatPesos(num)
}

/** "US$ 1.200" / "−US$ 50" — mismos separadores de miles que formatPesos, sin centavos. */
export function formatDolares(n: number | null | undefined): string {
  const num = Number(n) || 0
  const abs = Math.round(Math.abs(num))
  return num < 0 ? `${MINUS}US$ ${pesosFmt.format(abs)}` : `US$ ${pesosFmt.format(abs)}`
}

/** "87%" / "12,5%" — recibe el valor ya en escala 0-100 (no la fracción 0-1). */
export function formatPorcentaje(n: number | null | undefined, decimales = 0): string {
  const num = Number(n) || 0
  return `${num.toFixed(decimales).replace('.', ',')}%`
}

/** Entero plano sin separadores, para la columna "monto" del CSV (única excepción al formato con $). */
export function formatPesosCSV(n: number | null | undefined): string {
  return String(Math.round(Number(n) || 0))
}

export function formatFecha(d: string | Date | null | undefined): string {
  const f = aFechaSegura(d)
  if (!f) return ''
  const { anio, mes, dia } = partesAR(f)
  return `${pad2(dia)}/${pad2(mes)}/${anio}`
}

export function formatFechaHora(d: string | Date | null | undefined): string {
  const f = aFechaSegura(d)
  if (!f) return ''
  const { anio, mes, dia, hora, minuto } = partesAR(f)
  return `${pad2(dia)}/${pad2(mes)}/${anio} ${pad2(hora)}:${pad2(minuto)}`
}

export function formatFechaLarga(d: string | Date | null | undefined): string {
  const f = aFechaSegura(d)
  return f ? dateLargaFmt.format(f) : ''
}

/** "Octubre 2026" — título del mes para la vista mensual de Ocupación. */
export function formatMesAnio(d: string | Date | null | undefined): string {
  const f = aFechaSegura(d)
  if (!f) return ''
  const s = mesAnioFmt.format(f)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatHora(d: string | Date | null | undefined): string {
  const f = aFechaSegura(d)
  if (!f) return ''
  const { hora, minuto } = partesAR(f)
  return `${pad2(hora)}:${pad2(minuto)}`
}

/**
 * "27/12 al 09/01" (carperos) — el cruce de año calendario dentro de la
 * MISMA temporada activa (dic -> ene) es el caso normal de todos los días y
 * no lleva año. `conAnio=true` es explícito del llamador, para cuando el
 * rango no pertenece a la temporada activa (histórico).
 */
export function formatRangoFechas(desde: string | Date, hasta: string | Date, conAnio = false): string {
  const d1 = aFechaSegura(desde)
  const d2 = aFechaSegura(hasta)
  if (!d1 || !d2) return ''
  const fmtD = (f: Date) => {
    const { anio, mes, dia } = partesAR(f)
    return conAnio ? `${pad2(dia)}/${pad2(mes)}/${String(anio).slice(2)}` : `${pad2(dia)}/${pad2(mes)}`
  }
  if (d1.getTime() === d2.getTime()) return fmtD(d1)
  return `${fmtD(d1)} al ${fmtD(d2)}`
}

/** "30.123.456" a partir de solo dígitos. */
export function formatDNI(dni: string | number | null | undefined): string {
  const digits = String(dni ?? '').replace(/\D/g, '')
  if (digits.length < 7) return digits
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "20-30123456-7" a partir de 11 dígitos. */
export function formatCUIT(cuit: string | number | null | undefined): string {
  const digits = String(cuit ?? '').replace(/\D/g, '')
  if (digits.length !== 11) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

/** E.164 -> "+54 9 223 512-3456" (AR) o formato internacional genérico para otros países. */
export function formatTelefono(e164: string | null | undefined): string {
  if (!e164) return ''
  try {
    const phone = parsePhoneNumberFromString(e164)
    if (!phone) return e164
    if (phone.country === 'AR') {
      const n = phone.nationalNumber // ej "92235123456"
      const sinNueve = n.startsWith('9') ? n.slice(1) : n
      const cod = sinNueve.slice(0, 3)
      const resto = sinNueve.slice(3)
      const partido = resto.length > 4 ? `${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}` : resto
      return `+54 9 ${cod} ${partido}`
    }
    return phone.formatInternational()
  } catch {
    return e164
  }
}

/** dd/mm o dd/mm/aa a partir de una columna `date` "yyyy-mm-dd" pura — usado en la hoja A4 del Plano (PlanoImpresion), donde el listado de carperos necesita el formato corto "del dd/mm al dd/mm/aa". Distinto de formatRangoFechas (que ya arma el "al" entre dos fechas). */
export function formatFechaCorta(val: string | null | undefined, withYear = false): string {
  if (!val || !FECHA_SOLO_RE.test(val)) return ''
  const [y, m, d] = val.split('-')
  return withYear ? `${d}/${m}/${y.slice(2)}` : `${d}/${m}`
}

/** Normaliza para comparar sin importar mayúsculas/acentos (ej: "Perez" matchea "Pérez") — usado por el buscador, no es un formatter de visualización. */
export function normalizeText(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const COMPROBANTE_SIGLA: Record<string, string> = {
  factura_a: 'FA', factura_b: 'FB', factura_c: 'FC',
  recibo_a: 'RA', recibo_b: 'RB', recibo_c: 'RC', recibo_x: 'RX',
}

/** Formato único de comprobante en toda la app: "RB-3663" / "FB-727". Sin punto de venta, sin ceros a la izquierda. */
export function formatComprobante(tipo: string, numero: number | string): string {
  const sigla = COMPROBANTE_SIGLA[tipo] || '??'
  return `${sigla}-${String(numero ?? '').trim()}`
}

/**
 * Nombre propio en formato normal (31/10/2026). La base guarda los nombres
 * como vinieron cargados —muchos en MAYÚSCULAS ("ALICIA BENITES"), otros en
 * minúscula ("ana maria iacono")— y esto los normaliza SOLO al renderizar:
 * nunca se tocan los datos guardados, y las búsquedas siguen siendo
 * case-insensitive y sin tildes (ver normalizeText).
 *
 * Soporta español: tildes y ñ (se respeta la letra original, solo cambia la
 * caja), nombres compuestos, guiones ("Sáenz-Peña") y apóstrofes
 * ("D'Agostino", "O'Brien"). Las partículas de/del/la/las/los/y van en
 * minúscula salvo al principio ("Ana de la Cruz", pero "De la Cruz, Ana").
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'van', 'von'])

function capitalizarPalabra(palabra: string): string {
  if (!palabra) return palabra
  // Separadores internos que también arrancan "palabra nueva": guion y
  // apóstrofe. Se conservan tal cual en la salida.
  return palabra
    .split(/([-'’])/)
    .map((parte, i) => {
      if (i % 2 === 1) return parte // el separador
      if (!parte) return parte
      return parte.charAt(0).toLocaleUpperCase('es-AR') + parte.slice(1).toLocaleLowerCase('es-AR')
    })
    .join('')
}

export function formatNombre(nombre: string | null | undefined): string {
  const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ')
  if (!limpio) return ''
  return limpio
    .split(' ')
    .map((palabra, i) => {
      const bajo = palabra.toLocaleLowerCase('es-AR')
      if (i > 0 && PARTICULAS.has(bajo)) return bajo
      return capitalizarPalabra(palabra)
    })
    .join(' ')
}

const UNIDAD_LABEL: Record<string, string> = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }
const UNIDAD_EMOJI: Record<string, string> = { carpa: '🏠', sombrilla: '🏖️' }

/** "Carpa 19" / "Sombrilla 4" / "Cabina 2" / "Locker 12". */
export function formatUnidad(tipo: string, numero: number | string): string {
  return `${UNIDAD_LABEL[tipo] || tipo} ${numero}`
}

export function unidadEmoji(tipo: string): string {
  return UNIDAD_EMOJI[tipo] || ''
}

/**
 * Fechas de una reserva en una línea corta, para listados y resultados de
 * búsqueda (29/10/2026): período -> "05/01 → 20/01/2027" (el año solo al
 * final, no se repite), día -> "12/01/2027", temporada -> "" (la temporada
 * se identifica por su nombre, nunca por sus fechas — ver CLAUDE.md).
 */
export function formatFechasReserva(reserva: {
  tipo_alquiler?: string | null
  fecha?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
} | null | undefined): string {
  if (!reserva) return ''
  if (reserva.tipo_alquiler === 'dia') return formatFecha(reserva.fecha)
  if (reserva.tipo_alquiler === 'periodo') {
    const desde = formatFecha(reserva.fecha_inicio)
    const hasta = formatFecha(reserva.fecha_fin)
    if (!desde || !hasta) return desde || hasta
    // "05/01/2027 → 20/01/2027" se acorta a "05/01 → 20/01/2027" cuando los
    // dos extremos caen en el mismo año (el caso normal de un período).
    const desdeCorto = desde.slice(0, 5)
    return desde.slice(6) === hasta.slice(6) ? `${desdeCorto} → ${hasta}` : `${desde} → ${hasta}`
  }
  return ''
}

/** "hace 5 min" / "hace 2 h" / "hace 3 d" — notificaciones recientes; más allá de 7 días cae a formatFecha. */
export function formatTiempoRelativo(d: string | Date | null | undefined): string {
  const f = aFechaSegura(d)
  if (!f) return ''
  const diffMin = Math.floor((Date.now() - f.getTime()) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `hace ${diffD} d`
  return formatFecha(f)
}

/** "PRIUS-A3X9K2" — normaliza mayúsculas/prefijo si ya viene bien formado. */
export function formatCodigoReserva(codigo: string | null | undefined): string {
  return String(codigo ?? '').toUpperCase()
}

// Registros de `eventos` escritos antes de que fn_log_evento formateara los
// montos en origen quedaron con texto crudo tipo "Pago editado — $1200000"
// (dato histórico, no se reescribe). Esto lo arregla SOLO al mostrar: el
// signo "$" pegado a los dígitos (sin espacio ni separador de miles) es la
// única marca inequívoca de un monto en este formato — nunca matchea un
// comprobante ("RB-3661"), un DNI, un número de unidad ("#74") o una fecha
// ("2026-10-24"), ninguno de los cuales lleva "$" delante.
const MONTO_CRUDO_RE = /\$(\d+)/g

/** Formatea montos crudos ("$1200000" -> "$ 1.200.000") embebidos en texto libre de Historial, sin tocar el dato guardado. Ya formateados ("$ 1.200.000") quedan igual — no vuelve a matchear. */
export function formatMontosEnTexto(texto: string | null | undefined): string {
  if (!texto) return ''
  return limpiarNumeralUnidad(
    texto.replace(MONTO_CRUDO_RE, (_match, digitos: string) => formatPesos(Number(digitos))),
  )
}

/**
 * Saca el "#" de los textos de unidad ya GUARDADOS en la base (31/10/2026).
 *
 * El `#` se eliminó de toda la UI, pero los eventos de Historial escritos
 * antes quedaron con él ("Unidad carpa #11 → libre"). Esto lo limpia al
 * renderizar, sin tocar los registros históricos. Solo actúa sobre
 * "<palabra> #<número>", nunca sobre un "#" suelto o un color hex.
 */
const NUMERAL_UNIDAD_RE = /\b(carpa|sombrilla|cabina|locker|unidad)\s+#(\d+)/gi

export function limpiarNumeralUnidad(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto.replace(NUMERAL_UNIDAD_RE, (_m, palabra: string, numero: string) => `${palabra} ${numero}`)
}

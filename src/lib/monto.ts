// Formato argentino de un monto MIENTRAS SE ESCRIBE — fuente única del
// comportamiento de `components/inputs/MoneyInput` (nov 2026).
//
// Convención AR: el punto (.) es separador de MILES y la coma (,) es
// separador DECIMAL. De ahí las tres reglas de este módulo:
//
//   1. Los puntos de miles los pone el formateador solo, en vivo: la tecla
//      punto nunca crea decimales (se ignora). El bug que lo motivó: tipear
//      "3.150" para cargar $3.150.000 en el Total Z se convertía en "3,15"
//      (tomaba el punto como coma y se comía el cero) y después no dejaba
//      seguir escribiendo.
//   2. La coma habilita hasta 2 decimales y NUNCA se borran ceros mientras
//      se tipea ("340.000,50" se puede escribir de corrido).
//   3. Lo que se guarda es un número (3150000 / 340000.5), nunca el string
//      formateado.
//
// Se agrupa a mano (no `Intl`) para no perder precisión en los enteros muy
// largos que el usuario puede llegar a tipear, y porque acá el separador es
// siempre el argentino sin importar el locale del browser.
//
// Ver `lib/format.ts` para el sentido inverso (mostrar un monto ya guardado,
// con modo privacidad) y `lib/parse.ts` para el resto de los parseos.

export const MAX_DECIMALES = 2

/** "3150000" -> "3.150.000". Entra y sale un string de dígitos. */
function agruparMiles(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Lo que el usuario tiene tipeado -> `{ display, valor }`.
 * `display` es lo que va de nuevo al input (con los puntos de miles puestos
 * por nosotros) y `valor` el número a guardar (`null` si está vacío: "no se
 * cargó nada" es distinto de "se cargó $0").
 */
export function montoTipeado(
  raw: string | null | undefined,
  permitirNegativo = false,
): { display: string; valor: number | null } {
  const texto = String(raw ?? '')
  const negativo = permitirNegativo && texto.trimStart().startsWith('-')
  // Se descarta todo lo que no sea dígito o coma: los puntos que ya estaban
  // en pantalla y los que el usuario tipee se reponen solos más abajo.
  const limpio = texto.replace(/[^\d,]/g, '')
  const coma = limpio.indexOf(',')
  const enteroRaw = (coma === -1 ? limpio : limpio.slice(0, coma)).replace(/,/g, '')
  const decRaw = coma === -1 ? null : limpio.slice(coma + 1).replace(/,/g, '').slice(0, MAX_DECIMALES)
  const entero = enteroRaw.replace(/^0+(?=\d)/, '')

  if (!entero && decRaw === null) return { display: negativo ? '-' : '', valor: null }

  const signo = negativo ? '-' : ''
  // El decimal viaja como string para no perder el "0" recién tipeado de
  // ",50" ni la coma sola de "340.000," (valen 340000,50 y 340000).
  const display = signo + agruparMiles(entero || '0') + (decRaw === null ? '' : `,${decRaw}`)
  const valor = Number(`${signo}${entero || '0'}.${(decRaw || '0').padEnd(MAX_DECIMALES, '0')}`)
  return { display, valor: Number.isFinite(valor) ? valor : null }
}

/**
 * Texto pegado de afuera -> número. Acepta las dos convenciones porque el
 * administrador pega tanto de la app como del papel de la Z del controlador
 * fiscal, que imprime el total con punto decimal:
 *
 *   "3.150.000" -> 3150000   (varios puntos: miles)
 *   "3.150"     -> 3150      (un punto con 3 dígitos atrás: miles)
 *   "340000.00" -> 340000    (un punto con 1 o 2 dígitos atrás: decimal)
 *   "$ 340.000,50" -> 340000.5
 */
export function montoPegado(texto: string | null | undefined): number | null {
  const s = String(texto ?? '').replace(/[^\d.,-]/g, '')
  if (!s) return null
  const negativo = s.trimStart().startsWith('-')
  const cuerpo = s.replace(/-/g, '')

  let entero = cuerpo
  let dec = ''
  const ultimaComa = cuerpo.lastIndexOf(',')
  if (ultimaComa !== -1) {
    entero = cuerpo.slice(0, ultimaComa)
    dec = cuerpo.slice(ultimaComa + 1).replace(/\D/g, '')
  } else {
    const puntos = cuerpo.split('.').length - 1
    const ultimoPunto = cuerpo.lastIndexOf('.')
    const cola = ultimoPunto === -1 ? '' : cuerpo.slice(ultimoPunto + 1)
    if (puntos === 1 && /^\d{1,2}$/.test(cola)) {
      entero = cuerpo.slice(0, ultimoPunto)
      dec = cola
    }
  }

  entero = entero.replace(/\D/g, '')
  dec = dec.slice(0, MAX_DECIMALES)
  if (!entero && !dec) return null
  const n = Number(`${entero || '0'}.${dec.padEnd(MAX_DECIMALES, '0')}`)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

/**
 * Número guardado -> texto del input. Muestra centavos solo si los tiene
 * ("340.000" y "340.000,50"), nunca un ",00" de relleno.
 */
export function montoDisplay(n: number): string {
  const redondeado = Math.round(n * 100) / 100
  const abs = Math.abs(redondeado)
  const entero = Math.trunc(abs)
  const centavos = Math.round((abs - entero) * 100)
  const signo = redondeado < 0 ? '-' : ''
  return signo + agruparMiles(String(entero)) + (centavos ? `,${String(centavos).padStart(2, '0')}` : '')
}

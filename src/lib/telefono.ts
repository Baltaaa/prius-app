import { parsePhoneNumberFromString, type PhoneNumber } from 'libphonenumber-js'

/**
 * Normalización única de teléfonos argentinos (30/10/2026).
 *
 * Reemplaza la heurística a mano que vivía en `waLink()` (hooks/useLeads.js):
 * acá se resuelve de forma determinística con libphonenumber-js, que ya es
 * dependencia del proyecto. Saca espacios, guiones y paréntesis, el 0 de
 * característica y el 15 de celular, y devuelve E.164 (+549XXXXXXXXXX).
 *
 * Los datos reales de `leads` vienen en todos los formatos posibles:
 * "1133576424", "5491167694277", "+54 9 2235 28-5132", "+5493401411981".
 * Todos tienen que terminar en el mismo E.164.
 */

export interface TelefonoNormalizado {
  /** E.164 listo para wa.me / guardar, o null si no se pudo validar. */
  e164: string | null
  /** Para mostrar: "+54 9 223 528-5132". Cae al original si no se pudo parsear. */
  display: string
  /** false => "a revisar": no se pudo normalizar con confianza. */
  valido: boolean
}

/** Saca el 15 de celular local ("223 15 5285132" -> "2235285132"). */
function quitarQuince(soloDigitos: string): string {
  // El 15 va después de la característica (2 a 4 dígitos) y antes del abonado.
  return soloDigitos.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
}

function intentar(entrada: string): PhoneNumber | undefined {
  const tel = parsePhoneNumberFromString(entrada, 'AR')
  return tel && tel.isValid() ? tel : undefined
}

export function normalizarTelefonoAR(raw: string | null | undefined): TelefonoNormalizado {
  const original = String(raw ?? '').trim()
  if (!original) return { e164: null, display: '', valido: false }

  const digitos = original.replace(/\D/g, '')
  const sinCero = digitos.replace(/^0/, '')
  const sinQuince = quitarQuince(sinCero)
  // Número nacional de 10 dígitos (característica + abonado), sin 54 ni 9.
  const nacional = sinQuince.replace(/^54/, '').replace(/^9/, '')

  // El orden importa y está verificado contra los datos reales de `leads`:
  //
  // 1) `+549<nacional>` PRIMERO. Estos números son celulares que se contactan
  //    por WhatsApp, y AR necesita el 9 para eso. Si se probaba `original`
  //    antes, un "1133576424" parseaba como fijo y salía +541133576424 (sin
  //    9), que a wa.me no le sirve.
  // 2) El original, solo si ya venía en formato internacional de AR — así
  //    respeta un +54 9 ... bien escrito.
  //
  // NO se prueba `+<digitos>` a secas: "4552785140" matcheaba como número
  // válido de Dinamarca (+45) y generaba un link de WhatsApp a un
  // desconocido en el exterior. Cualquier candidato internacional tiene que
  // ser explícitamente argentino.
  const candidatos: string[] = []
  if (nacional.length >= 8) candidatos.push(`+549${nacional}`)
  if (/^(\+?54)/.test(original.replace(/\s/g, ''))) candidatos.push(original)
  if (sinQuince.startsWith('54')) candidatos.push(`+${sinQuince}`)

  for (const c of candidatos) {
    const tel = intentar(c)
    if (!tel || tel.country !== 'AR') continue
    return {
      e164: tel.number,
      display: tel.formatInternational(),
      valido: true,
    }
  }

  return { e164: null, display: original, valido: false }
}

/**
 * Link de WhatsApp SOLO para números validados — si el número está "a
 * revisar" devuelve null y el botón que lo use tiene que quedar deshabilitado.
 */
export function waLink(raw: string | null | undefined): string | null {
  const { e164, valido } = normalizarTelefonoAR(raw)
  if (!valido || !e164) return null
  return `https://wa.me/${e164.replace('+', '')}`
}

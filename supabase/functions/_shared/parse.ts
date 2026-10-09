// Espejo de src/lib/parse.ts — mantener sincronizado.
// Corre en runtime Deno (Edge Functions), no puede importar el TS del
// bundle de Vite, así que la lógica de normalización se duplica a mano
// acá. Si cambia una regla en src/lib/parse.ts, replicarla aquí también.
import { parsePhoneNumberFromString, isValidPhoneNumber } from "npm:libphonenumber-js@1/min"

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"])

export function normalizarNombre(raw: string | null | undefined): string {
  const limpio = String(raw ?? "").trim().replace(/\s+/g, " ").replace(/[´`]/g, "'")
  if (!limpio) return ""
  return limpio
    .split(" ")
    .map((palabra, i) => {
      const partes = palabra.split("'")
      const capitalizada = partes
        .map((p, pi) => {
          if (!p) return p
          const lower = p.toLocaleLowerCase("es-AR")
          if (pi === 0 && i > 0 && PARTICULAS.has(lower)) return lower
          return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1)
        })
        .join("'")
      return capitalizada
    })
    .join(" ")
}

export function parseTelefono(raw: string | null | undefined, defaultCountry: "AR" | string = "AR"): string | null {
  if (!raw) return null
  const limpio = raw.trim()
  if (!limpio) return null
  try {
    // deno-lint-ignore no-explicit-any
    if (!isValidPhoneNumber(limpio, defaultCountry as any)) return null
    // deno-lint-ignore no-explicit-any
    const phone = parsePhoneNumberFromString(limpio, defaultCountry as any)
    return phone ? phone.number : null
  } catch {
    return null
  }
}

export function parseDNI(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "")
}

export function dniValido(raw: string | null | undefined): boolean {
  const digits = parseDNI(raw)
  if (digits.length < 7 || digits.length > 8) return false
  const n = Number(digits)
  return n >= 1_000_000 && n <= 99_999_999
}

export function normalizarEmail(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase()
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailValido(raw: string | null | undefined): boolean {
  const email = normalizarEmail(raw)
  return email.length === 0 || EMAIL_REGEX.test(email)
}

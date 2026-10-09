// Rate limiting por IP para las Edge Functions públicas de reservas (Fase 2,
// oct 2026). La clave nunca guarda la IP en crudo: accion + ':' +
// sha256(ip + RATE_LIMIT_SALT). El contador vive en la tabla `rate_limits`,
// consumido vía RPC `consumir_rate_limit` (service_role, ventanas fijas).
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"

export function obtenerIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return "desconocida"
}

async function sha256Hex(texto: string): Promise<string> {
  const data = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function consumirLimite(
  supabase: SupabaseClient,
  accion: string,
  ip: string,
  max: number,
  ventanaSeg: number,
): Promise<boolean> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") || ""
  const hash = await sha256Hex(ip + salt)
  const clave = `${accion}:${hash}`
  const { data, error } = await supabase.rpc("consumir_rate_limit", {
    p_clave: clave,
    p_max: max,
    p_ventana_seg: ventanaSeg,
  })
  if (error) {
    console.error("[ratelimit] error consultando límite:", error)
    return true // una falla de infra no debe bloquear al cliente real
  }
  return data === true
}

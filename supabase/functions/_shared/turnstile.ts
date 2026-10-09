// Verificación de Cloudflare Turnstile (Fase 2, oct 2026). Secret
// TURNSTILE_SECRET_KEY — hoy la clave de prueba de Cloudflare que siempre
// valida (1x0000000000000000000000000000000AA), reemplazar por la real
// antes de activar config_reservas_publicas.activo.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export async function verificarTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!token) return false
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY") || ""
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip })
    const res = await fetch(VERIFY_URL, { method: "POST", body })
    if (!res.ok) return false
    const data = await res.json()
    return data?.success === true
  } catch (err) {
    console.error("[turnstile] error de verificación:", err)
    return false
  }
}

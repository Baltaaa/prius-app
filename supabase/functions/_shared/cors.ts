// CORS compartido por TODAS las Edge Functions (reglas en CLAUDE.md).
// Nunca "*": estas funciones aceptan POST con datos de contacto o acciones
// de superadmin.
//
// Orígenes permitidos: los fijos de abajo (CRM en producción, previews de
// Cloudflare Pages, dev local y sitio público) más lo que haya en el secret
// ALLOWED_ORIGINS (lista separada por comas). Los fijos están en el código a
// propósito: hotfix 03/11/2026 — el secret no incluía https://prius-app.pages.dev
// y el navegador bloqueaba el preflight de superadmin-action y tipo-cambio
// ("Failed to send a request to the Edge Function").
const ORIGENES_FIJOS = [
  "https://prius-app.pages.dev",
  "http://localhost:5173",
  "https://priusplayagrande.com.ar",
  "https://www.priusplayagrande.com.ar",
]
// Previews de Cloudflare Pages: https://<hash-o-rama>.prius-app.pages.dev
const PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.prius-app\.pages\.dev$/

const ORIGENES_ENV = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)

export function origenPermitido(origin: string | null): boolean {
  if (!origin) return false
  return ORIGENES_FIJOS.includes(origin) || ORIGENES_ENV.includes(origin) || PREVIEW_REGEX.test(origin)
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
  if (origenPermitido(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string
  }
  return headers
}

// Preflight: siempre 200, con los headers de CORS correspondientes al
// origen (o sin Access-Control-Allow-Origin si no está permitido).
export function responderPreflight(req: Request): Response {
  return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) })
}

function conCors(res: Response, cors: Record<string, string>): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

// Reemplaza a `Deno.serve`: responde el preflight y garantiza los headers de
// CORS en TODA respuesta, incluida cualquier excepción que escape del handler
// (sin esto, un error de arranque o un throw fuera del try/catch de la
// función llega al navegador como error de CORS y no como el error real).
export function servirConCors(
  handler: (req: Request, cors: Record<string, string>) => Response | Promise<Response>,
) {
  Deno.serve(async (req) => {
    const cors = corsHeaders(req.headers.get("origin"))
    if (req.method === "OPTIONS") return responderPreflight(req)
    try {
      return conCors(await handler(req, cors), cors)
    } catch (err) {
      console.error("[cors] error no capturado por la función:", err)
      return new Response(
        JSON.stringify({ ok: false, error: "interno", mensaje: "No pudimos procesar el pedido. Probá de nuevo en unos minutos." }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors } },
      )
    }
  })
}

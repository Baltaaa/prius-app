// CORS compartido por las Edge Functions públicas de reservas (Fase 2,
// oct 2026). Orígenes permitidos desde el secret ALLOWED_ORIGINS (lista
// separada por comas) — nunca "*", porque estas funciones aceptan POST con
// datos de contacto.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  return headers
}

// Preflight: siempre 200, con los headers de CORS correspondientes al
// origen (o sin Access-Control-Allow-Origin si no está permitido).
export function responderPreflight(req: Request): Response {
  return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) })
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, responderPreflight } from "../_shared/cors.ts"
import { obtenerIp, consumirLimite } from "../_shared/ratelimit.ts"
import { json, datosInvalidos, rateLimited, errorInterno } from "../_shared/respuesta.ts"

// Sin Turnstile: la abre directo la página del QR (GET), no hay form que
// resolver. El rate limit más permisivo (30 cada 10 min) la protege igual.
const CODIGO_REGEX = /^PRIUS-[A-HJ-NP-Z2-9]{6}$/

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"))
  if (req.method === "OPTIONS") return responderPreflight(req)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  try {
    const ip = obtenerIp(req)
    const dentroDelLimite = await consumirLimite(supabase, "consultar", ip, 30, 600)
    if (!dentroDelLimite) return rateLimited(cors)

    let codigo: string | null = null
    if (req.method === "GET") {
      codigo = new URL(req.url).searchParams.get("codigo")
    } else if (req.method === "POST") {
      try {
        const body = await req.json()
        codigo = body?.codigo ?? null
      } catch {
        return datosInvalidos({ body: "JSON inválido" }, cors)
      }
    } else {
      return datosInvalidos({ metodo: "Método no soportado" }, cors)
    }

    codigo = String(codigo ?? "").trim().toUpperCase()
    if (!CODIGO_REGEX.test(codigo)) {
      return datosInvalidos({ codigo: "El código no tiene el formato esperado" }, cors)
    }

    const { data, error } = await supabase.rpc("consultar_reserva_publica", { p_codigo: codigo })
    if (error) return errorInterno(error, cors)
    return json(data, 200, cors)
  } catch (err) {
    return errorInterno(err, cors)
  }
})

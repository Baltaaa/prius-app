import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { z } from "npm:zod@3"
import { corsHeaders, responderPreflight } from "../_shared/cors.ts"
import { obtenerIp, consumirLimite } from "../_shared/ratelimit.ts"
import { verificarTurnstile } from "../_shared/turnstile.ts"
import { normalizarNombre, parseTelefono, normalizarEmail, emailValido } from "../_shared/parse.ts"
import { json, datosInvalidos, captchaInvalido, rateLimited, errorInterno } from "../_shared/respuesta.ts"
import { usuarioDelRequest } from "../_shared/usuario.ts"

// Fase 5A (nov 2026): el token de usuario es opcional. Si viene uno válido
// (cliente logueado con Google), el lead guarda el email de la cuenta en vez
// del tipeado y queda marcado en datos_form.cuenta_google. verify_jwt: false
// en el deploy: sin sesión el form sigue andando (Turnstile + rate limit).

const Entrada = z.object({
  lead_id: z.string().uuid().nullable().optional(),
  nombre: z.string().min(1),
  telefono_e164: z.string().min(1),
  email: z.string().nullable().optional(),
  motivo: z.enum(["form_abandonado", "grupo_grande", "temporada", "sin_disponibilidad"]),
  mensaje: z.string().nullable().optional(),
  datos_form: z.record(z.unknown()).nullable().optional(),
  // Sin min(1): un token vacío o ausente tiene que llegar a verificarTurnstile
  // y volver captcha_invalido (403), no quedar atrapado como datos_invalidos.
  turnstile_token: z.string().optional().default(""),
})

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"))
  if (req.method === "OPTIONS") return responderPreflight(req)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  try {
    const ip = obtenerIp(req)
    const dentroDelLimite = await consumirLimite(supabase, "lead", ip, 20, 3600)
    if (!dentroDelLimite) return rateLimited(cors)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return datosInvalidos({ body: "JSON inválido" }, cors)
    }

    const parsed = Entrada.safeParse(body)
    if (!parsed.success) {
      const campos: Record<string, string> = {}
      for (const issue of parsed.error.issues) campos[issue.path.join(".") || "body"] = issue.message
      return datosInvalidos(campos, cors)
    }
    const input = parsed.data

    const turnstileOk = await verificarTurnstile(input.turnstile_token, ip)
    if (!turnstileOk) return captchaInvalido(cors)

    const campos: Record<string, string> = {}
    const nombre = normalizarNombre(input.nombre)
    const telefono = parseTelefono(input.telefono_e164)
    const usuario = await usuarioDelRequest(supabase, req)
    const emailCuenta = usuario?.email ? normalizarEmail(usuario.email) : null
    const email = emailCuenta ?? (input.email ? normalizarEmail(input.email) : null)

    if (!nombre) campos["nombre"] = "Ingresá un nombre válido"
    if (!telefono) campos["telefono_e164"] = "El teléfono no es válido"
    if (email && !emailValido(email)) campos["email"] = "El email no es válido"

    if (Object.keys(campos).length > 0) return datosInvalidos(campos, cors)

    const { data, error } = await supabase.rpc("guardar_lead_reserva", {
      p: {
        lead_id: input.lead_id ?? null,
        nombre,
        telefono_e164: telefono,
        email,
        motivo: input.motivo,
        mensaje: input.mensaje ?? null,
        datos_form: emailCuenta
          ? { ...(input.datos_form ?? {}), cuenta_google: true, email_verificado: emailCuenta }
          : (input.datos_form ?? null),
      },
    })

    if (error) return errorInterno(error, cors)
    return json(data, 200, cors)
  } catch (err) {
    return errorInterno(err, cors)
  }
})

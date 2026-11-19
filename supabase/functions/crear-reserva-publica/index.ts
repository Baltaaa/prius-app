import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { z } from "npm:zod@3"
import { corsHeaders, responderPreflight } from "../_shared/cors.ts"
import { obtenerIp, consumirLimite } from "../_shared/ratelimit.ts"
import { verificarTurnstile } from "../_shared/turnstile.ts"
import { normalizarNombre, parseTelefono, dniValido, parseDNI, emailValido, normalizarEmail } from "../_shared/parse.ts"
import { json, datosInvalidos, captchaInvalido, rateLimited, errorInterno } from "../_shared/respuesta.ts"
import { usuarioDelRequest } from "../_shared/usuario.ts"

// Fase 5A (nov 2026): reservar exige login de cliente (Google). El gateway
// NO verifica el JWT (verify_jwt: false en el deploy) para poder responder
// 401 login_requerido con CORS; el token se valida acá con getUser().
// El cliente de la reserva sale del vínculo de la cuenta (clientes_cuentas),
// no del body; el email sale de la cuenta, nunca del body.

const Entrada = z.object({
  tipo_alquiler: z.enum(["dia", "periodo"]),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cantidad_personas: z.number().int().min(1).max(30),
  tipo_unidad: z.enum(["carpa", "sombrilla"]),
  unidad_ids: z.array(z.string().uuid()).min(1).max(2),
  metodo_pago: z.enum(["efectivo", "transferencia", "mercado_pago", "tarjeta_debito", "tarjeta_credito"]),
  cliente: z.object({
    nombre: z.string().min(1),
    apellido: z.string().min(1),
    telefono_e164: z.string().min(1),
    // Ignorado: el email sale de la cuenta de Google (JWT), no del form.
    email: z.string().nullable().optional(),
    dni: z.string().nullable().optional(),
  }),
  lead_id: z.string().uuid().nullable().optional(),
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
    const usuario = await usuarioDelRequest(supabase, req)
    if (!usuario) {
      return json(
        { ok: false, error: "login_requerido", mensaje: "Ingresá con tu cuenta de Google para reservar." },
        401,
        cors,
      )
    }

    const ip = obtenerIp(req)

    const dentroDelLimite = await consumirLimite(supabase, "crear", ip, 5, 3600)
    if (!dentroDelLimite) return rateLimited(cors)
    // Mismo límite por cuenta: cambiar de red no da más intentos.
    const dentroDelLimiteCuenta = await consumirLimite(supabase, "crear_cuenta", usuario.id, 5, 3600)
    if (!dentroDelLimiteCuenta) return rateLimited(cors)

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

    // Normalización final con las mismas reglas que el resto de la app.
    const campos: Record<string, string> = {}
    const nombre = normalizarNombre(input.cliente.nombre)
    const apellido = normalizarNombre(input.cliente.apellido)
    const telefono = parseTelefono(input.cliente.telefono_e164)
    const email = normalizarEmail(usuario.email)
    const dni = input.cliente.dni ? parseDNI(input.cliente.dni) : null

    if (!nombre) campos["cliente.nombre"] = "Ingresá un nombre válido"
    if (!apellido) campos["cliente.apellido"] = "Ingresá un apellido válido"
    if (!telefono) campos["cliente.telefono_e164"] = "El teléfono no es válido"
    if (!emailValido(email) || !email) campos["cliente.email"] = "Tu cuenta no tiene un email válido"
    if (dni !== null && !dniValido(dni)) campos["cliente.dni"] = "El DNI no es válido"
    if (input.hasta < input.desde) campos["hasta"] = "La fecha hasta no puede ser anterior a desde"

    if (Object.keys(campos).length > 0) return datosInvalidos(campos, cors)

    const { data, error } = await supabase.rpc("crear_reserva_publica", {
      p_user_id: usuario.id,
      p: {
        tipo_alquiler: input.tipo_alquiler,
        desde: input.desde,
        hasta: input.hasta,
        cantidad_personas: input.cantidad_personas,
        tipo_unidad: input.tipo_unidad,
        unidad_ids: input.unidad_ids,
        metodo_pago: input.metodo_pago,
        cliente: { nombre, apellido, telefono_e164: telefono, email, dni },
        lead_id: input.lead_id ?? null,
      },
    })

    if (error) return errorInterno(error, cors)
    return json(data, 200, cors)
  } catch (err) {
    return errorInterno(err, cors)
  }
})

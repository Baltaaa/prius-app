import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { z } from "npm:zod@3"

// Función interna (no pública, mismo criterio que enviar-qr-reserva): la
// invoca el CRM con el JWT del usuario logueado, verificación de JWT por
// defecto de Supabase (sin --no-verify-jwt en el deploy). No hace falta
// Turnstile ni rate limit por IP — el límite acá es por usuario y lo maneja
// la tabla `superadmin_intentos` (5 fallos seguidos -> 15 min de bloqueo).
//
// Mini-prompt 26/10/2026 — confirmación con contraseña de superadmin para
// acciones sensibles: reemplaza el "escribí el nombre para confirmar"
// (ConfirmDeleteModal) por reingresar la contraseña, verificada ACÁ del
// lado servidor con un cliente Supabase descartable (signInWithPassword,
// `persistSession: false` — nunca toca la sesión del browser que llamó)
// antes de ejecutar la acción real via `fn_ejecutar_accion_superadmin`
// (dispatcher Postgres, lista blanca de acciones — ver la migración
// superadmin_password_confirmacion).
//
// Helpers de cors/respuesta INLINEADOS acá (no `../_shared/*.ts`) — el
// bundler del deploy vía MCP no resuelve imports relativos fuera del
// directorio de la función; si en algún momento se despliega con la CLI
// de Supabase (que sí resuelve `../_shared`), se puede volver a separarlos
// sin tocar la lógica.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((o) => o.trim()).filter(Boolean)
function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin
  return headers
}
function responderPreflight(req: Request): Response {
  return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) })
}
function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } })
}
function datosInvalidos(campos: Record<string, string>, cors: Record<string, string>): Response {
  return json({ ok: false, error: "datos_invalidos", campos }, 400, cors)
}
function errorInterno(detalle: unknown, cors: Record<string, string>): Response {
  console.error("[superadmin-action] error interno:", detalle)
  return json({ ok: false, error: "interno", mensaje: "No pudimos procesar la acción. Probá de nuevo en unos minutos." }, 500, cors)
}

// Lista blanca de acciones espejada acá SOLO para validar la forma del
// body antes de pegarle a la base — la lista blanca real (la que importa
// de verdad) vive en el dispatcher de Postgres (fn_ejecutar_accion_superadmin).
const ACCIONES_VALIDAS = [
  "eliminar_reserva",
  "eliminar_cliente",
  "quitar_cosocio",
  "eliminar_lead",
  "anular_pago",
  "editar_comprobante",
  "editar_monto_pago_vigente",
  "cambiar_estado_pago_manual",
  "revertir_estado_pago_automatico",
  "reabrir_caja",
] as const

const Entrada = z.object({
  password: z.string().min(1),
  accion: z.enum(ACCIONES_VALIDAS),
  params: z.record(z.unknown()).default({}),
})

// Descripción humana para el Historial — "qué se va a afectar", mismo
// criterio de una línea que ya usa el resto de fn_log_evento.
function describirAccion(accion: string, params: Record<string, unknown>): string {
  switch (accion) {
    case "eliminar_reserva":
      return "Eliminó una reserva y sus pagos asociados"
    case "eliminar_cliente":
      return "Eliminó un cliente"
    case "quitar_cosocio":
      return "Quitó un cosocio de una reserva"
    case "eliminar_lead":
      return "Eliminó un lead"
    case "anular_pago":
      return `Anuló un pago${params.motivo ? ` — ${params.motivo}` : ""}`
    case "editar_comprobante":
      return "Editó el monto o tipo de un comprobante"
    case "editar_monto_pago_vigente":
      return "Corrigió el monto de un pago ya verificado"
    case "cambiar_estado_pago_manual":
      return `Ajustó el estado de pago a mano${params.motivo ? ` — ${params.motivo}` : ""}`
    case "revertir_estado_pago_automatico":
      return "Volvió el estado de pago al cálculo automático"
    case "reabrir_caja":
      return `Reabrió una caja${params.motivo ? ` — ${params.motivo}` : ""}`
    default:
      return `Ejecutó la acción ${accion}`
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"))
  if (req.method === "OPTIONS") return responderPreflight(req)

  const authHeader = req.headers.get("authorization") ?? ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "")
  if (!jwt) return json({ ok: false, error: "no_autorizado", mensaje: "Falta la sesión." }, 401, cors)

  const url = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // Cliente "como el usuario" (anon key + su JWT, RLS normal) — solo para
  // identificarlo y leer su propio perfil, nunca para escribir nada.
  const supabaseUsuario = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // Cliente service_role — el único con EXECUTE sobre el dispatcher y las
  // RPC destructivas desde acá en más (ver migración).
  const supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: userData, error: userError } = await supabaseUsuario.auth.getUser()
    if (userError || !userData?.user) {
      return json({ ok: false, error: "no_autorizado", mensaje: "Sesión inválida." }, 401, cors)
    }
    const userId = userData.user.id

    // Rol real desde `perfiles` con el JWT del usuario (RLS normal, no se
    // confía en nada que mande el cliente) — admin NUNCA ve esto en la UI,
    // pero si de todos modos llegara a pegarle a este endpoint, se corta acá.
    const { data: perfil, error: perfilError } = await supabaseUsuario
      .from("perfiles")
      .select("rol, activo")
      .eq("user_id", userId)
      .maybeSingle()
    if (perfilError || !perfil || perfil.rol !== "superadmin" || !perfil.activo) {
      return json({ ok: false, error: "no_autorizado", mensaje: "Esta acción es solo para superadmin." }, 403, cors)
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return datosInvalidos({ body: "JSON inválido" }, cors)
    }
    const parsed = Entrada.safeParse(body)
    if (!parsed.success) {
      return datosInvalidos({ body: "Faltan o son inválidos password/accion/params" }, cors)
    }
    const { password, accion, params } = parsed.data

    // Bloqueo por 5 fallos seguidos (15 min) — se chequea ANTES de gastar un
    // intento de signInWithPassword.
    const { data: bloqueadoHasta, error: bloqueoError } = await supabaseAdmin.rpc(
      "fn_superadmin_chequear_bloqueo",
      { p_user_id: userId },
    )
    if (bloqueoError) return errorInterno(bloqueoError, cors)
    if (bloqueadoHasta) {
      return json(
        {
          ok: false,
          error: "bloqueado",
          mensaje: "Demasiados intentos con contraseña incorrecta. Probá de nuevo en unos minutos.",
          bloqueado_hasta: bloqueadoHasta,
        },
        429,
        cors,
      )
    }

    // Verificación de la contraseña del lado servidor: un cliente NUEVO y
    // descartable (persistSession/autoRefreshToken en false) — esto NUNCA
    // toca la sesión del browser que hizo la request; es una sesión aparte
    // que vive y muere acá adentro de la función.
    const email = userData.user.email
    if (!email) return errorInterno("El usuario no tiene email asociado", cors)

    const clienteDescartable = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: passwordError } = await clienteDescartable.auth.signInWithPassword({ email, password })

    if (passwordError) {
      const intento = await supabaseAdmin.rpc("fn_superadmin_registrar_intento", {
        p_user_id: userId,
        p_exitoso: false,
      })
      const fallos = intento.data?.fallos_consecutivos ?? null
      const bloqueado = intento.data?.bloqueado_hasta ?? null
      await supabaseAdmin.rpc("fn_registrar_evento_superadmin", {
        p_user_id: userId,
        p_tipo_evento: bloqueado ? "superadmin_bloqueado" : "superadmin_password_fallido",
        p_descripcion: bloqueado
          ? "Bloqueado 15 minutos por intentos fallidos de contraseña"
          : `Contraseña incorrecta al intentar: ${describirAccion(accion, params as Record<string, unknown>)}`,
        p_datos: { accion, params, fallos_consecutivos: fallos },
      })
      if (bloqueado) {
        return json(
          {
            ok: false,
            error: "bloqueado",
            mensaje: "Demasiados intentos con contraseña incorrecta. Probá de nuevo en 15 minutos.",
            bloqueado_hasta: bloqueado,
          },
          429,
          cors,
        )
      }
      return json({ ok: false, error: "password_incorrecta", mensaje: "Contraseña incorrecta." }, 401, cors)
    }

    // Contraseña correcta: resetea el contador de fallos y ejecuta la acción
    // real via el dispatcher (service_role — las RPC de abajo ya no tienen
    // EXECUTE para `authenticated`, solo el dispatcher puede llamarlas).
    await supabaseAdmin.rpc("fn_superadmin_registrar_intento", { p_user_id: userId, p_exitoso: true })

    const { data: resultado, error: accionError } = await supabaseAdmin.rpc("fn_ejecutar_accion_superadmin", {
      p_user_id: userId,
      p_accion: accion,
      p_params: params,
    })

    if (accionError) {
      await supabaseAdmin.rpc("fn_registrar_evento_superadmin", {
        p_user_id: userId,
        p_tipo_evento: "superadmin_password_ok",
        p_descripcion: `Contraseña correcta, pero la acción falló: ${describirAccion(accion, params as Record<string, unknown>)} — ${accionError.message}`,
        p_datos: { accion, params, error: accionError.message },
      })
      return errorInterno(accionError, cors)
    }

    await supabaseAdmin.rpc("fn_registrar_evento_superadmin", {
      p_user_id: userId,
      p_tipo_evento: "superadmin_password_ok",
      p_descripcion: describirAccion(accion, params as Record<string, unknown>),
      p_datos: { accion, params },
    })

    return json({ ok: true, resultado }, 200, cors)
  } catch (err) {
    return errorInterno(err, cors)
  }
})

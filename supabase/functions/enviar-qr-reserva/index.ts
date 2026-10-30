import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { Resend } from "npm:resend@4"
import QRCode from "npm:qrcode@1.5.4"
import { Buffer } from "node:buffer"
import { z } from "npm:zod@3"
import { corsHeaders, responderPreflight } from "../_shared/cors.ts"
import { json, datosInvalidos, errorInterno } from "../_shared/respuesta.ts"

// Función interna (no pública): la invoca el CRM con el JWT del usuario
// logueado, así que corre con la verificación de JWT por defecto de Supabase
// (sin --no-verify-jwt en el deploy). No hace falta Turnstile ni rate limit
// propio, a diferencia de crear-reserva-publica/consultar-reserva/lead-reserva.
//
// Fase 5 del roadmap de reservas públicas (entrega del QR) — hoy solo cubre
// el envío por email de UNA reserva (un código con una sola unidad). Si en el
// futuro un código agrupa 2 unidades (ver codigos_reserva.unidades_contiguas),
// esta función habría que extenderla para listar todas las reservas de ese
// código, no solo la que llega por reserva_id.

const Entrada = z.object({
  reserva_id: z.string().uuid(),
})

const TIPO_UNIDAD_LABEL: Record<string, string> = {
  carpa: "Carpa",
  sombrilla: "Sombrilla",
  cabina: "Cabina",
  locker: "Locker",
}

function formatFechaArgentina(fechaIso: string | null): string | null {
  if (!fechaIso) return null
  // Columnas `date` puras ancladas a mediodía UTC antes de formatear, mismo
  // criterio que el front (ver CLAUDE.md "Formato y validación de datos"),
  // para no correrse un día por la zona horaria.
  const fecha = new Date(`${fechaIso}T12:00:00Z`)
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha)
}

function construirHtml(opts: {
  nombreCliente: string
  codigo: string
  fechaCheckin: string | null
  unidadLabel: string
  contentId: string
}): string {
  const { nombreCliente, codigo, fechaCheckin, unidadLabel, contentId } = opts
  const filaFecha = fechaCheckin
    ? `<tr><td style="padding:4px 0;color:#000000;font-size:14px;">Fecha de check-in: <strong>${fechaCheckin}</strong></td></tr>`
    : ""

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#FFFFFF;font-family:Inter,Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:24px;">
                <p style="margin:0;color:#000000;font-size:16px;">Hola ${nombreCliente},</p>
                <p style="margin:8px 0 0;color:#000000;font-size:14px;">
                  Este es tu código de reserva en Prius Playa Grande. Presentá
                  este QR en recepción para hacer el check-in.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <div style="display:inline-block;padding:12px 20px;border:2px solid #F2CA50;border-radius:4px;">
                  <span style="font-size:22px;font-weight:700;letter-spacing:1px;color:#000000;">${codigo}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="cid:${contentId}" width="200" height="200" alt="QR de la reserva ${codigo}" style="display:block;border:none;" />
              </td>
            </tr>
            <tr><td style="padding:4px 0;color:#000000;font-size:14px;">Unidad asignada: <strong>${unidadLabel}</strong></td></tr>
            ${filaFecha}
            <tr>
              <td style="padding-top:24px;color:#000000;font-size:14px;">
                Presentá este QR en recepción.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"))
  if (req.method === "OPTIONS") return responderPreflight(req)
  if (req.method !== "POST") return datosInvalidos({ metodo: "Método no soportado" }, cors)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  let reserva: {
    id: string
    codigo: string | null
    tipo_alquiler: string | null
    fecha: string | null
    fecha_inicio: string | null
    cliente: { nombre: string; apellido: string | null; mail: string | null } | null
    unidad: { numero: number; tipo: string } | null
    temporada: { fecha_inicio: string } | null
  } | null = null

  try {
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

    const { data, error } = await supabase
      .from("reservas")
      .select(`
        id,
        codigo,
        tipo_alquiler,
        fecha,
        fecha_inicio,
        cliente:clientes ( nombre, apellido, mail ),
        unidad:unidades ( numero, tipo ),
        temporada:temporadas ( fecha_inicio )
      `)
      .eq("id", parsed.data.reserva_id)
      .maybeSingle()

    if (error) return errorInterno(error, cors)
    reserva = data as typeof reserva
  } catch (err) {
    return errorInterno(err, cors)
  }

  if (!reserva) {
    return json({ ok: false, error: "no_encontrada", mensaje: "No encontramos esa reserva." }, 404, cors)
  }
  if (!reserva.codigo) {
    return datosInvalidos({ codigo: "La reserva no tiene un código de reserva web asociado" }, cors)
  }
  if (!reserva.cliente?.mail) {
    return datosInvalidos({ mail: "El cliente no tiene un email cargado" }, cors)
  }
  if (!reserva.unidad) {
    return datosInvalidos({ unidad: "La reserva no tiene una unidad asignada" }, cors)
  }

  const codigo = reserva.codigo
  const nombreCliente = [reserva.cliente.nombre, reserva.cliente.apellido].filter(Boolean).join(" ")
  const unidadLabel = `${TIPO_UNIDAD_LABEL[reserva.unidad.tipo] ?? reserva.unidad.tipo} ${reserva.unidad.numero}`
  const fechaCheckinIso = reserva.fecha ?? reserva.fecha_inicio ?? reserva.temporada?.fecha_inicio ?? null
  const fechaCheckin = formatFechaArgentina(fechaCheckinIso)

  let qrBuffer: Buffer | null = null
  try {
    const dataUrl = await QRCode.toDataURL(codigo, { margin: 1, width: 400 })
    const base64 = dataUrl.split(",")[1]
    qrBuffer = Buffer.from(base64, "base64")
  } catch (err) {
    return errorInterno(err, cors)
  }

  const contentId = `qr-${codigo}`
  const html = construirHtml({ nombreCliente, codigo, fechaCheckin, unidadLabel, contentId })

  const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

  // Sin replyTo: config_reservas_publicas no tiene una columna de mail de
  // contacto del balneario hoy — agregar acá si en algún momento se suma.
  const { data, error } = await resend.emails.send({
    from: "Prius Playa Grande <reservas@mail.priusplayagrande.com.ar>",
    to: [reserva.cliente.mail],
    subject: `Tu código de reserva ${codigo} — Prius Playa Grande`,
    html,
    attachments: [
      {
        filename: `qr-${codigo}.png`,
        content: qrBuffer!,
        contentId,
      },
    ],
    idempotencyKey: `reserva-qr/${codigo}`,
  })

  if (error) {
    console.error("[enviar-qr-reserva] error de Resend:", error)
    return json({ ok: false, error: "envio_fallido", mensaje: error.message }, 502, cors)
  }

  return json({ id: data!.id }, 200, cors)
})

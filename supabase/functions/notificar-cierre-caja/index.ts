import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import * as webpush from "jsr:@negrel/webpush@^0.5.0"
import { servirConCors } from "../_shared/cors.ts"
import { leerSecretos } from "../_shared/secretos.ts"

// Aviso automático al cerrar la caja (nov 2026, Tarea 5).
//
// pg_cron la despierta cada 5 minutos (fn_disparar_notificaciones) y procesa
// la cola `notificaciones_cola`: por cada caja cerrada pendiente arma el
// resumen (resumen_cierre_caja — fuente única), genera el PDF
// (generar-reporte-pdf) y manda WhatsApp + Web Push.
//
// Regla: NINGÚN canal puede voltear el proceso. Cada uno se intenta por
// separado y su resultado queda guardado en la fila de la cola.
//
// Modos (body.modo):
//   * "cola"     (default) — procesa lo pendiente. Lo llama el cron.
//   * "prueba"   — manda el aviso de la última caja real cerrada, marcado
//                  como PRUEBA. No crea ni modifica ninguna caja.
//   * "reenviar" — vuelve a mandar el de una caja concreta (caja_id).
// "prueba" y "reenviar" las dispara un superadmin desde la app.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// INTERNAL_SECRET y las VAPID salen del vault (ver _shared/secretos.ts), no
// de Deno.env: el cron ya lee de ahí y así hay un solo lugar donde rotar.

const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || ""
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || ""
const WA_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "resumen_cierre_caja"
const WA_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "es_AR"
const WA_API = Deno.env.get("WHATSAPP_API_VERSION") || "v21.0"

const SITIO = Deno.env.get("SITIO_URL") || "https://prius-app.pages.dev"
const MAX_INTENTOS = 3

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } })
}

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ------------------------------------------------------------- formatos
// Una sola línea, sin saltos ni tabs: es requisito de las variables de
// plantilla de Meta.
const nf = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const pesos = (n: unknown) => nf.format(Number(n ?? 0)).replace(/\s+/g, " ")
const porc = (n: unknown) => (n == null ? "sin datos" : `${Number(n).toFixed(1).replace(".", ",")}%`)
const unaLinea = (s: string) => String(s).replace(/[\n\r\t]+/g, " ").replace(/\s{2,}/g, " ").trim()

function ddmm(iso: string): string {
  const [, m, d] = String(iso).slice(0, 10).split("-")
  return `${d}/${m}`
}
function ddmmaaaaGuion(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-")
  return `${d}-${m}-${y}`
}

/** "99/144" por tipo de unidad, para las variables 8 y 9 de la plantilla. */
function ocupTipo(resumen: any, tipo: string): string {
  const t = (resumen.ocupacion?.por_tipo ?? []).find((x: any) => x.tipo === tipo)
  return t ? `${t.ocupadas}/${t.total}` : "0/0"
}

// -------------------------------------------------------------- canales

async function pdfDeLaCaja(cajaId: string, internalSecret: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generar-reporte-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        "x-prius-secret": internalSecret,
      },
      body: JSON.stringify({ modo: "cierre", caja_id: cajaId }),
      signal: AbortSignal.timeout(25000),
    })
    const j = await res.json()
    return j?.url ?? null
  } catch (err) {
    console.error("[notificar] no se pudo generar el PDF:", err)
    return null
  }
}

/** WhatsApp Cloud API: plantilla utility con el PDF en el header. */
async function enviarCloudApi(resumen: any, destinatarios: any[], pdfUrl: string | null, esPrueba: boolean) {
  if (!WA_TOKEN || !WA_PHONE_ID) return { canal: "cloud_api", ok: false, motivo: "faltan_secrets" }
  const fecha = String(resumen.fecha).slice(0, 10)
  const egr = resumen.egresos ?? {}

  // Orden exacto de las variables de cuerpo de la plantilla.
  const variables = [
    ddmm(fecha),                                   // 1 fecha DD/MM
    pesos(resumen.ingresos?.total),                // 2 ingresos
    pesos(egr.total),                              // 3 egresos
    pesos(egr.total_f),                            // 4 egresos F
    pesos(egr.total_sf),                           // 5 egresos SF
    pesos(resumen.neto),                           // 6 neto
    porc(resumen.ocupacion?.total?.pct),           // 7 ocupación %
    ocupTipo(resumen, "carpa"),                    // 8 carpas ocupadas/total
    ocupTipo(resumen, "sombrilla"),                // 9 sombrillas ocupadas/total
    (esPrueba ? "PRUEBA - " : "") + (resumen.cierre?.quien ?? "cierre automático"), // 10
  ].map(unaLinea)

  const resultados: any[] = []
  for (const d of destinatarios) {
    const componentes: any[] = []
    if (pdfUrl) {
      componentes.push({
        type: "header",
        parameters: [{
          type: "document",
          document: { link: pdfUrl, filename: `Caja Prius ${ddmmaaaaGuion(fecha)}.pdf` },
        }],
      })
    }
    componentes.push({ type: "body", parameters: variables.map((text) => ({ type: "text", text })) })
    // Botón URL dinámico: el sufijo que se le agrega a la URL base de la
    // plantilla (https://prius-app.pages.dev/caja/{{1}}/resumen).
    componentes.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: fecha }] })

    try {
      const res = await fetch(`https://graph.facebook.com/${WA_API}/${WA_PHONE_ID}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${WA_TOKEN}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: String(d.telefono_e164 ?? "").replace(/\D/g, ""),
          type: "template",
          template: { name: WA_TEMPLATE, language: { code: WA_LANG }, components: componentes },
        }),
        signal: AbortSignal.timeout(15000),
      })
      const j = await res.json().catch(() => ({}))
      resultados.push({ nombre: d.nombre, ok: res.ok, status: res.status, id: j?.messages?.[0]?.id, error: j?.error?.message })
    } catch (err) {
      resultados.push({ nombre: d.nombre, ok: false, error: String(err) })
    }
  }
  return { canal: "cloud_api", ok: resultados.some((r) => r.ok), resultados }
}

/** Fallback: texto plano por CallMeBot, a quien tenga apikey cargada. */
async function enviarCallMeBot(texto: string, destinatarios: any[]) {
  const conClave = destinatarios.filter((d) => d.callmebot_apikey)
  if (conClave.length === 0) return { canal: "callmebot", ok: false, motivo: "sin_apikeys" }
  const resultados: any[] = []
  for (const d of conClave) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(d.telefono_e164)}`
        + `&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(d.callmebot_apikey)}`
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      resultados.push({ nombre: d.nombre, ok: res.ok, status: res.status })
    } catch (err) {
      resultados.push({ nombre: d.nombre, ok: false, error: String(err) })
    }
  }
  return { canal: "callmebot", ok: resultados.some((r) => r.ok), resultados }
}

/** Texto plano del resumen — CallMeBot y el cuerpo del push largo. */
function textoResumen(resumen: any, esPrueba: boolean): string {
  const egr = resumen.egresos ?? {}
  const fecha = String(resumen.fecha).slice(0, 10)
  return [
    `${esPrueba ? "[PRUEBA] " : ""}Prius - Caja cerrada ${ddmm(fecha)}`,
    `Ingresos: ${pesos(resumen.ingresos?.total)}`,
    `Egresos: ${pesos(egr.total)} (F ${pesos(egr.total_f)} / SF ${pesos(egr.total_sf)})`,
    `Neto: ${pesos(resumen.neto)}`,
    `Ocupacion: ${porc(resumen.ocupacion?.total?.pct)}`,
    `${resumen.cierre?.quien ?? "cierre automatico"}`,
    `${SITIO}/caja/${fecha}/resumen`,
  ].join("\n")
}

/** Web Push a los superadmin suscriptos. Borra las suscripciones muertas. */
async function enviarPush(sb: any, resumen: any, mostrarMontos: boolean, esPrueba: boolean, vapid: { publica: string; privada: string; subject: string }) {
  if (!vapid.privada || !vapid.publica) return { canal: "push", ok: false, motivo: "faltan_vapid" }

  const { data: supers } = await sb.from("perfiles").select("user_id").eq("rol", "superadmin").eq("activo", true)
  const ids = (supers ?? []).map((p: any) => p.user_id)
  if (ids.length === 0) return { canal: "push", ok: false, motivo: "sin_superadmins" }

  const { data: subs } = await sb.from("push_suscripciones").select("*").in("user_id", ids)
  if (!subs || subs.length === 0) return { canal: "push", ok: false, motivo: "sin_suscripciones" }

  const fecha = String(resumen.fecha).slice(0, 10)
  const egr = resumen.egresos ?? {}
  const cuerpo = mostrarMontos
    ? `Neto ${pesos(resumen.neto)} · Ocupación ${porc(resumen.ocupacion?.total?.pct)} · Egresos ${pesos(egr.total)} (SF ${pesos(egr.total_sf)})`
    : `Ocupación ${porc(resumen.ocupacion?.total?.pct)} · ${resumen.cierre?.quien ?? "cierre automático"}`

  const payload = JSON.stringify({
    title: `${esPrueba ? "[PRUEBA] " : ""}Caja cerrada · ${ddmm(fecha)}`,
    body: cuerpo,
    url: `/caja/${fecha}/resumen`,
    tag: `cierre-${fecha}`,
  })

  let app
  try {
    app = await webpush.ApplicationServer.new({
      contactInformation: vapid.subject || "mailto:bruschettibalta@gmail.com",
      // VAPID_PRIVATE_KEY es el par exportado en JWK ({publicKey, privateKey}),
      // que es exactamente lo que espera importVapidKeys.
      vapidKeys: await webpush.importVapidKeys(JSON.parse(vapid.privada), { extractable: false }),
    })
  } catch (err) {
    console.error("[notificar] VAPID inválido:", err)
    return { canal: "push", ok: false, motivo: "vapid_invalido" }
  }

  const resultados: any[] = []
  for (const s of subs) {
    const suscripcion = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
    try {
      await app.subscribe(suscripcion as any).pushTextMessage(payload, { ttl: 86400 } as any)
      resultados.push({ endpoint: s.endpoint.slice(-12), ok: true })
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status
      // 404 / 410: el navegador tiró la suscripción. Se borra, no se reintenta.
      if (status === 404 || status === 410) {
        await sb.from("push_suscripciones").delete().eq("id", s.id)
        resultados.push({ endpoint: s.endpoint.slice(-12), ok: false, borrada: true })
      } else {
        resultados.push({ endpoint: s.endpoint.slice(-12), ok: false, error: String(err).slice(0, 200) })
      }
    }
  }
  return { canal: "push", ok: resultados.some((r) => r.ok), resultados }
}

// ------------------------------------------------------------- proceso

async function procesarCaja(sb: any, cajaId: string, esPrueba: boolean) {
  const secretos = await leerSecretos()
  const vapid = {
    publica: secretos.VAPID_PUBLIC_KEY,
    privada: secretos.VAPID_PRIVATE_KEY,
    subject: secretos.VAPID_SUBJECT,
  }

  const { data: resumen, error } = await sb.rpc("resumen_cierre_caja", { p_caja_id: cajaId })
  if (error || !resumen) throw new Error(`resumen_cierre_caja: ${error?.message ?? "sin datos"}`)

  const { data: cfg } = await sb.from("config_notificaciones").select("*").eq("id", true).maybeSingle()
  const destinatarios = ((cfg?.destinatarios ?? []) as any[]).filter((d) => d?.activo && d?.telefono_e164)
  const canal = cfg?.canal_whatsapp ?? "cloud_api"

  const resultado: Record<string, unknown> = {}

  // WhatsApp: el PDF solo se genera si de verdad se va a mandar algo.
  if (canal !== "off" && destinatarios.length > 0) {
    if (canal === "cloud_api" && WA_TOKEN && WA_PHONE_ID) {
      const pdfUrl = await pdfDeLaCaja(cajaId, secretos.INTERNAL_SECRET)
      resultado.whatsapp = await enviarCloudApi(resumen, destinatarios, pdfUrl, esPrueba)
    } else {
      // Sin secrets de Cloud API, o canal = callmebot: texto plano con el link.
      resultado.whatsapp = await enviarCallMeBot(textoResumen(resumen, esPrueba), destinatarios)
    }
  } else {
    resultado.whatsapp = { canal, ok: false, motivo: canal === "off" ? "canal_off" : "sin_destinatarios" }
  }

  // Push: siempre, pase lo que pase con WhatsApp.
  resultado.push = await enviarPush(sb, resumen, cfg?.mostrar_montos_en_push ?? true, esPrueba, vapid)

  return resultado
}

async function procesarCola(sb: any) {
  const { data: filas } = await sb
    .from("notificaciones_cola")
    .select("*")
    .eq("estado", "pendiente")
    .lte("enviar_despues_de", new Date().toISOString())
    .lt("intentos", MAX_INTENTOS)
    .order("created_at", { ascending: true })
    .limit(10)

  const procesadas: any[] = []
  for (const fila of filas ?? []) {
    try {
      const resultado = await procesarCaja(sb, fila.caja_id, fila.es_prueba)
      const algo = Object.values(resultado).some((r: any) => r?.ok)
      await sb.from("notificaciones_cola").update({
        estado: algo ? "enviado" : "error",
        intentos: fila.intentos + 1,
        resultado,
        ultimo_error: algo ? null : "ningún canal pudo enviar",
        sent_at: algo ? new Date().toISOString() : null,
        // Backoff: 5, 20 y 45 minutos.
        enviar_despues_de: algo
          ? fila.enviar_despues_de
          : new Date(Date.now() + [5, 20, 45][Math.min(fila.intentos, 2)] * 60_000).toISOString(),
      }).eq("id", fila.id)
      procesadas.push({ caja_id: fila.caja_id, ok: algo, resultado })
    } catch (err) {
      await sb.from("notificaciones_cola").update({
        estado: fila.intentos + 1 >= MAX_INTENTOS ? "error" : "pendiente",
        intentos: fila.intentos + 1,
        ultimo_error: String(err).slice(0, 500),
        enviar_despues_de: new Date(Date.now() + 10 * 60_000).toISOString(),
      }).eq("id", fila.id)
      procesadas.push({ caja_id: fila.caja_id, ok: false, error: String(err) })
    }
  }
  return procesadas
}

// --------------------------------------------------------------- handler

servirConCors(async (req, cors) => {
  if (req.method !== "POST") return json({ ok: false, error: "metodo_no_permitido" }, 405, cors)

  const sb = admin()
  const { INTERNAL_SECRET } = await leerSecretos()
  const secret = req.headers.get("x-prius-secret")
  const esInterno = Boolean(INTERNAL_SECRET) && secret === INTERNAL_SECRET

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* el cron manda un body mínimo */ }
  const modo = String(body.modo ?? "cola")

  // "prueba" y "reenviar" las dispara una persona: hace falta superadmin.
  if (!esInterno) {
    const auth = req.headers.get("Authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
    if (!token) return json({ ok: false, error: "no_autenticado" }, 401, cors)
    const { data: userData } = await sb.auth.getUser(token)
    const userId = userData?.user?.id
    if (!userId) return json({ ok: false, error: "no_autenticado" }, 401, cors)
    const { data: perfil } = await sb.from("perfiles").select("rol, activo").eq("user_id", userId).maybeSingle()
    if (!perfil?.activo || perfil.rol !== "superadmin") {
      return json({ ok: false, error: "sin_permiso", mensaje: "Solo el superadmin puede mandar avisos." }, 403, cors)
    }
    if (modo === "cola") {
      return json({ ok: false, error: "datos_invalidos", mensaje: "La cola la procesa el sistema." }, 400, cors)
    }
  }

  if (modo === "cola") {
    const procesadas = await procesarCola(sb)
    return json({ ok: true, procesadas: procesadas.length, detalle: procesadas }, 200, cors)
  }

  if (modo === "prueba") {
    // La última caja REAL cerrada. No se crea ni se toca ninguna caja.
    const { data: caja } = await sb
      .from("caja_diaria").select("id, fecha").eq("estado", "cerrada")
      .order("fecha", { ascending: false }).limit(1).maybeSingle()
    if (!caja) {
      return json({ ok: false, error: "sin_cajas", mensaje: "Todavía no hay ninguna caja cerrada para usar de ejemplo." }, 400, cors)
    }
    const resultado = await procesarCaja(sb, caja.id, true)
    return json({ ok: true, caja: caja.fecha, resultado }, 200, cors)
  }

  if (modo === "reenviar") {
    const cajaId = String(body.caja_id ?? "")
    if (!cajaId) return json({ ok: false, error: "datos_invalidos", mensaje: "Falta caja_id." }, 400, cors)
    const resultado = await procesarCaja(sb, cajaId, false)
    return json({ ok: true, resultado }, 200, cors)
  }

  return json({ ok: false, error: "modo_desconocido" }, 400, cors)
})

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { servirConCors } from "../_shared/cors.ts"

// Punto 4 (30/10/2026): cotización del dólar para pagos en USD.
// Se consulta DolarApi DESDE ACÁ, nunca desde el cliente, y se cachea en
// `tipos_cambio`. Si la API falla o tarda, se devuelve la última cotización
// guardada con `stale: true` — el CRM nunca se queda sin un número para
// trabajar, y la UI puede avisar que no es de hoy.
function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } })
}

const FUENTES: Record<string, string> = {
  oficial: "https://dolarapi.com/v1/dolares/oficial",
  blue: "https://dolarapi.com/v1/dolares/blue",
}

const hoyAR = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())

async function traerDeApi(tipo: string) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(FUENTES[tipo], { signal: ctrl.signal, headers: { accept: "application/json" } })
    if (!res.ok) return null
    const d = await res.json()
    const compra = Number(d?.compra)
    const venta = Number(d?.venta)
    if (!Number.isFinite(venta) || venta <= 0) return null
    return { compra: Number.isFinite(compra) ? compra : null, venta }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

servirConCors(async (_req, cors) => {
  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const fecha = hoyAR()
  const salida: Record<string, unknown> = {}
  let algunoFresco = false

  for (const tipo of ["oficial", "blue"]) {
    const api = await traerDeApi(tipo)
    if (api) {
      algunoFresco = true
      await admin.from("tipos_cambio").upsert(
        { fecha, tipo, compra: api.compra, venta: api.venta, fuente: "dolarapi", updated_at: new Date().toISOString() },
        { onConflict: "fecha,tipo" },
      )
      salida[tipo] = { fecha, compra: api.compra, venta: api.venta, stale: false }
      continue
    }
    // Fallback: última guardada, sea de hoy o de antes.
    const { data } = await admin
      .from("tipos_cambio")
      .select("fecha, compra, venta, updated_at")
      .eq("tipo", tipo)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle()
    salida[tipo] = data
      ? { fecha: data.fecha, compra: data.compra, venta: data.venta, stale: data.fecha !== fecha, updated_at: data.updated_at }
      : null
  }

  if (!salida.oficial && !salida.blue) {
    return json({ ok: false, error: "sin_cotizacion", mensaje: "No pudimos obtener la cotización y no hay ninguna guardada." }, 503, cors)
  }

  return json({ ok: true, fecha, fresco: algunoFresco, cotizaciones: salida }, 200, cors)
})

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Mismas coordenadas que `src/config/clima.ts` (spot 3640 de Windguru,
// "Mar del Plata - Base Naval") — duplicadas a mano porque esta función
// corre en su propio runtime Deno, aislado del bundle de Vite del CRM. Si
// se cambia el spot, hay que actualizar los dos lugares.
const LAT = -38.0361
const LON = -57.535
const TIMEZONE = "America/Argentina/Buenos_Aires"

// Hoy + 14 días (15 en total) = la ventana real de pronóstico de Open-Meteo
// que ofrecemos. Nada de `past_days`: un día pasado simplemente no viene en
// la respuesta, y el handler ya responde `disponible: false` para eso.
const FORECAST_DIAS = 15

const CACHE_TTL_MS = 30 * 60 * 1000

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  })
}

async function fetchJson(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`)
  return res.json()
}

// Cache en memoria del módulo (sobrevive entre invocaciones mientras la
// instancia del edge function siga caliente) — un solo fetch real a
// Open-Meteo cada 30 minutos, sin importar cuántos clientes/fechas pidan el
// chip en ese rato. Guarda el dataset CRUDO (los 15 días completos), no una
// fecha puntual: así una sola entrada de cache sirve cualquier fecha dentro
// de la ventana.
let cacheCrudo: { at: number; forecast: any; marine: any } | null = null

async function obtenerDatosCrudos() {
  if (cacheCrudo && Date.now() - cacheCrudo.at < CACHE_TTL_MS) return cacheCrudo

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,uv_index` +
    `&wind_speed_unit=kmh&timezone=${encodeURIComponent(TIMEZONE)}&forecast_days=${FORECAST_DIAS}`

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}` +
    `&hourly=wave_height,wave_period&length_unit=metric&timezone=${encodeURIComponent(TIMEZONE)}&forecast_days=${FORECAST_DIAS}`

  const [forecast, marine] = await Promise.all([fetchJson(forecastUrl), fetchJson(marineUrl)])
  cacheCrudo = { at: Date.now(), forecast, marine }
  return cacheCrudo
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  const url = new URL(req.url)
  const fechaParam = url.searchParams.get("fecha") || ""
  const fecha = FECHA_RE.test(fechaParam) ? fechaParam : new Date().toISOString().slice(0, 10)

  try {
    const { forecast, marine } = await obtenerDatosCrudos()
    const fh = forecast?.hourly || {}
    const mh = marine?.hourly || {}
    const marineIndexPorHora = new Map<string, number>()
    for (let i = 0; i < (mh.time?.length || 0); i++) marineIndexPorHora.set(mh.time[i], i)

    const horas: Array<Record<string, unknown>> = []
    for (let i = 0; i < (fh.time?.length || 0); i++) {
      const ts = fh.time[i] as string // "2026-10-08T14:00"
      if (!ts.startsWith(fecha)) continue
      const im = marineIndexPorHora.get(ts)
      horas.push({
        hora: ts.slice(11, 16),
        temperatura: fh.temperature_2m?.[i] ?? null,
        sensacion: fh.apparent_temperature?.[i] ?? null,
        viento: fh.wind_speed_10m?.[i] ?? null,
        rafaga: fh.wind_gusts_10m?.[i] ?? null,
        direccion: fh.wind_direction_10m?.[i] ?? null,
        precipitacion: fh.precipitation?.[i] ?? null,
        uv: fh.uv_index?.[i] ?? null,
        olaAltura: im != null ? mh.wave_height?.[im] ?? null : null,
        olaPeriodo: im != null ? mh.wave_period?.[im] ?? null : null,
      })
    }

    return jsonResponse({ fecha, disponible: horas.length > 0, horas })
  } catch (err) {
    return jsonResponse(
      { fecha, disponible: false, horas: [], error: String((err as Error)?.message || err) },
      502,
    )
  }
})

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { servirConCors } from "../_shared/cors.ts"
import {
  A4, MARGEN, COLOR, crearDocumento, encabezado, pie, titulo, texto,
  tarjetasKpi, barras, barrasApiladas, barrasHorizontales, dona, ocupacionPorTipo, tabla,
} from "./pdf.ts"

// Generador ÚNICO de PDF de Prius (nov 2026, Tarea 4).
//
// Dos modos:
//   * `cierre`  (caja_id)      -> el cierre de una caja.
//   * `periodo` (desde, hasta) -> el reporte de un rango.
//
// Los datos salen SOLO de las RPCs de la Tarea 2 (resumen_cierre_caja /
// reporte_resumen): el PDF no puede mostrar números distintos de los de la
// pantalla porque no calcula nada por su cuenta.
//
// Autenticación, dos caminos:
//   * JWT de un usuario con rol superadmin o admin (el CRM).
//   * Header `x-prius-secret` igual al secret `INTERNAL_SECRET`, para las
//     llamadas server-to-server (el aviso de cierre de caja).
//
// El PDF se guarda en el bucket privado "reportes" y se devuelve una signed
// URL corta: nunca se expone por una URL pública.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") || ""
const BUCKET = "reportes"
const VALIDEZ_URL_SEG = 3600

const SITIO = Deno.env.get("SITIO_URL") || "https://prius-app.pages.dev"
let logoCache: Uint8Array | null | undefined

async function logo(): Promise<Uint8Array | null> {
  if (logoCache !== undefined) return logoCache
  try {
    const res = await fetch(`${SITIO}/images/prius-icon.png`, { signal: AbortSignal.timeout(5000) })
    logoCache = res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    logoCache = null
  }
  return logoCache
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } })
}

// ------------------------------------------------------------- formatos
// Mismos criterios que el front (lib/format.ts): es-AR, punto de miles.
const nfPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const pesos = (n: unknown) => nfPesos.format(Number(n ?? 0))
const pesosCorto = (n: unknown) => {
  const v = Number(n ?? 0)
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(".", ",")}M`
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1000)}K`
  return pesos(v)
}
const porc = (n: unknown) => (n == null ? "—" : `${Number(n).toFixed(1).replace(".", ",")}%`)

function fechaAr(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = String(iso).slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function ahoraAr(): string {
  const f = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  })
  return f.format(new Date()).replace(",", " a las")
}

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", mercado_pago: "Mercado Pago",
  tarjeta_debito: "Tarjeta de débito", tarjeta_credito: "Tarjeta de crédito",
}

// ------------------------------------------------------------------ PDF

async function pdfPeriodo(resumen: any): Promise<Uint8Array> {
  const { pdf, tipo } = await crearDocumento()
  const logoBytes = await logo()
  const act = resumen.actual ?? {}
  const ing = act.ingresos ?? {}
  const egr = act.egresos ?? {}
  const temp = resumen.temporada ?? {}
  const d = resumen.deltas ?? {}
  const periodo = `${fechaAr(resumen.periodo?.desde)} al ${fechaAr(resumen.periodo?.hasta)}`
  const serie = (resumen.serie ?? []).map((r: any) => ({
    // `desde`, no `bucket`: con granularidad semanal o mensual el bucket
    // arranca antes del inicio del período (date_trunc).
    label: fechaAr(r.desde ?? r.bucket).slice(0, 5),
    valor: Number(r.ingresos ?? 0),
    f: Number(r.egresos_f ?? 0),
    sf: Number(r.egresos_sf ?? 0),
  }))

  // --------------------------------------------------------- página 1
  const p1 = pdf.addPage([A4.ancho, A4.alto])
  let y = await encabezado(pdf, p1, tipo, { titulo: "Reporte de gestión", periodo, logoBytes })

  const delta = (v: unknown) => (v == null ? "sin comparación" : `${Number(v) >= 0 ? "+" : ""}${porc(v)} vs anterior`)
  y = tarjetasKpi(p1, tipo, y, [
    { label: "Resultado neto", valor: pesos(act.neto), sub: delta(d.neto) },
    { label: "Ingresos", valor: pesos(ing.total), sub: `${Number(ing.cantidad ?? 0)} cobros · ${delta(d.ingresos)}` },
    { label: "Egresos", valor: pesos(egr.total), sub: egr.pct_sf == null ? "sin egresos" : `${porc(egr.pct_sf)} sin factura` },
    { label: "Ocupación", valor: porc(act.ocupacion?.promedio_pct), sub: "promedio del período" },
  ])

  y = titulo(p1, tipo, "Ingresos en el tiempo", y)
  y = barras(p1, tipo, y, serie, 110, pesosCorto)

  y = titulo(p1, tipo, "Ingresos por medio de pago", y)
  y = dona(
    p1, tipo, y,
    (ing.por_medio ?? []).map((x: any) => ({ label: MEDIO_LABEL[x.medio] ?? x.medio, valor: Number(x.total ?? 0) })),
    pesos,
  )

  y = titulo(p1, tipo, "Ingresos por tipo de unidad y de alquiler", y)
  y = barrasHorizontales(
    p1, tipo, y,
    [
      ...(ing.por_tipo_unidad ?? []).map((x: any) => ({ label: x.tipo, valor: Number(x.total ?? 0) })),
      ...(ing.por_tipo_alquiler ?? []).map((x: any) => ({ label: x.tipo, valor: Number(x.total ?? 0) })),
    ],
    pesos,
  )

  // --------------------------------------------------------- página 2
  const p2 = pdf.addPage([A4.ancho, A4.alto])
  let y2 = await encabezado(pdf, p2, tipo, { titulo: "Egresos y ocupación", periodo, logoBytes })

  y2 = tarjetasKpi(p2, tipo, y2, [
    { label: "Con factura (F)", valor: pesos(egr.total_f), sub: `${Number(egr.cantidad_f ?? 0)} gastos` },
    { label: "Sin factura (SF)", valor: pesos(egr.total_sf), sub: egr.pct_sf == null ? "—" : `${porc(egr.pct_sf)} del total` },
    { label: "Egresos / ingresos", valor: porc(egr.ratio_sobre_ingresos), sub: "del período" },
    { label: "Gasto promedio diario", valor: pesos(egr.promedio_diario), sub: `${Number(act.dias ?? 0)} días` },
  ])

  y2 = titulo(p2, tipo, "Con factura vs sin factura", y2)
  y2 = barrasApiladas(p2, tipo, y2, serie, 100, pesosCorto)

  y2 = titulo(p2, tipo, "Egresos por categoría", y2)
  y2 = tabla(
    p2, tipo, y2,
    [
      { titulo: "Categoría", ancho: 170 },
      { titulo: "Cant.", ancho: 45, der: true },
      { titulo: "Con factura", ancho: 95, der: true },
      { titulo: "Sin factura", ancho: 95, der: true },
      { titulo: "Total", ancho: 106, der: true },
    ],
    (egr.por_categoria ?? []).map((c: any) => [
      c.nombre ?? c.categoria, String(c.cantidad ?? ""), pesos(c.total_f), pesos(c.total_sf), pesos(c.total),
    ]),
  )

  if ((egr.mas_grandes ?? []).length > 0) {
    y2 = titulo(p2, tipo, "Los gastos más grandes del período", y2)
    y2 = tabla(
      p2, tipo, y2,
      [
        { titulo: "Fecha", ancho: 56 },
        { titulo: "Tipo", ancho: 30 },
        { titulo: "Concepto", ancho: 150 },
        { titulo: "Categoría", ancho: 115 },
        { titulo: "Proveedor", ancho: 80 },
        { titulo: "Monto", ancho: 80, der: true },
      ],
      (egr.mas_grandes ?? []).slice(0, 10).map((g: any) => [
        fechaAr(g.fecha), g.tipo_comprobante ?? "", g.concepto ?? "", g.categoria ?? "", g.proveedor ?? "—", pesos(g.monto),
      ]),
    )
  }

  y2 = titulo(p2, tipo, "Temporada", y2)
  texto(p2, tipo, `Comprometido ${pesos(temp.comprometido)} · Cobrado ${pesos(temp.cobrado)} (${porc(temp.pct_cobrado)}) · Por cobrar ${pesos(temp.por_cobrar)}`,
    { x: MARGEN, y: y2, size: 8.5 })

  const generado = ahoraAr()
  pie(p1, tipo, 1, 2, generado)
  pie(p2, tipo, 2, 2, generado)
  return await pdf.save()
}

async function pdfCierre(r: any): Promise<Uint8Array> {
  const { pdf, tipo } = await crearDocumento()
  const logoBytes = await logo()
  const egr = r.egresos ?? {}
  const ocup = r.ocupacion ?? {}
  const page = pdf.addPage([A4.ancho, A4.alto])
  let y = await encabezado(pdf, page, tipo, {
    titulo: "Cierre de caja",
    periodo: fechaAr(r.fecha),
    logoBytes,
  })

  y = tarjetasKpi(page, tipo, y, [
    { label: "Ingresos", valor: pesos(r.ingresos?.total), sub: `${(r.ingresos?.por_medio ?? []).length} medios` },
    { label: "Egresos", valor: pesos(egr.total), sub: `F ${pesos(egr.total_f)} · SF ${pesos(egr.total_sf)}` },
    { label: "Resultado neto", valor: pesos(r.neto), sub: r.cierre?.quien ?? "" },
    { label: "Ocupación", valor: porc(ocup.total?.pct), sub: `${ocup.total?.ocupadas ?? 0} de ${ocup.total?.total ?? 0}` },
  ])

  y = titulo(page, tipo, "Ingresos por medio de pago", y)
  y = tabla(
    page, tipo, y,
    [
      { titulo: "Medio", ancho: 180 },
      { titulo: "Cant.", ancho: 60, der: true },
      { titulo: "Ingresos", ancho: 135, der: true },
      { titulo: "Egresos", ancho: 136, der: true },
    ],
    (r.ingresos?.por_medio ?? []).map((m: any) => [
      MEDIO_LABEL[m.medio] ?? m.medio, String(m.cantidad ?? ""), pesos(m.ingresos), pesos(m.egresos),
    ]),
  )

  if (r.z?.numero) {
    y = titulo(page, tipo, "Cierre Z — controlador fiscal", y)
    texto(page, tipo, `Z N° ${r.z.numero} · ${pesos(r.z.total)} · ${r.z.cantidad_comprobantes ?? 0} comprobantes (${r.z.primer_comprobante ?? "—"} a ${r.z.ultimo_comprobante ?? "—"})`,
      { x: MARGEN, y, size: 8.5 })
    y -= 20
  }

  y = titulo(page, tipo, "Egresos del día", y)
  if ((egr.detalle ?? []).length === 0) {
    texto(page, tipo, "Sin egresos registrados en esta caja.", { x: MARGEN, y, size: 8.5, color: COLOR.tinta2 })
    y -= 20
  } else {
    y = tabla(
      page, tipo, y,
      [
        { titulo: "Tipo", ancho: 34 },
        { titulo: "Concepto", ancho: 140 },
        { titulo: "Categoría", ancho: 115 },
        { titulo: "Proveedor", ancho: 92 },
        { titulo: "Factura", ancho: 70 },
        { titulo: "Monto", ancho: 60, der: true },
      ],
      (egr.detalle ?? []).map((g: any) => [
        g.tipo_comprobante ?? "", g.concepto ?? "", g.categoria_nombre ?? g.categoria ?? "",
        g.proveedor ?? "—", [g.letra_factura, g.numero_factura].filter(Boolean).join(" ") || "—", pesos(g.monto),
      ]),
    )
    y = barrasHorizontales(
      page, tipo, y,
      [
        { label: "Con factura (F)", valor: Number(egr.total_f ?? 0), color: COLOR.oro },
        { label: "Sin factura (SF)", valor: Number(egr.total_sf ?? 0), color: COLOR.neutro },
      ],
      pesos,
    )
  }

  y = titulo(page, tipo, "Ocupación del día", y)
  y = ocupacionPorTipo(page, tipo, y, (ocup.por_tipo ?? []).map((t: any) => ({
    tipo: t.tipo, ocupadas: t.ocupadas, total: t.total, pct: t.pct,
  })))

  y = titulo(page, tipo, "Acumulado y temporada", y)
  const mes = r.acumulado_mes ?? {}
  texto(page, tipo, `Mes (${fechaAr(mes.desde)} al ${fechaAr(mes.hasta)}): ingresos ${pesos(mes.ingresos)} · egresos ${pesos(mes.egresos)} · neto ${pesos(mes.neto)}`,
    { x: MARGEN, y, size: 8.5 })
  y -= 13
  const t = r.temporada ?? {}
  texto(page, tipo, `Temporada ${t.nombre ?? ""}: comprometido ${pesos(t.comprometido)} · cobrado ${pesos(t.cobrado)} (${porc(t.pct_cobrado)}) · por cobrar ${pesos(t.por_cobrar)}`,
    { x: MARGEN, y, size: 8.5 })
  y -= 13
  const sem = r.semana_anterior
  texto(page, tipo, sem
    ? `Mismo día de la semana anterior (${fechaAr(sem.fecha)}): ingresos ${pesos(sem.ingresos)} · ocupación ${porc(sem.ocupacion_pct)}`
    : "Mismo día de la semana anterior: sin datos para comparar.",
    { x: MARGEN, y, size: 8.5, color: COLOR.tinta2 })

  pie(page, tipo, 1, 1, ahoraAr())
  return await pdf.save()
}

// --------------------------------------------------------------- handler

servirConCors(async (req, cors) => {
  if (req.method !== "POST") return json({ ok: false, error: "metodo_no_permitido" }, 405, cors)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Camino 1: secret interno (server-to-server, el aviso de cierre de caja).
  const secret = req.headers.get("x-prius-secret")
  let autorizado = Boolean(INTERNAL_SECRET) && secret === INTERNAL_SECRET

  // Camino 2: JWT de un usuario con rol superadmin o admin.
  if (!autorizado) {
    const auth = req.headers.get("Authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
    if (!token) return json({ ok: false, error: "no_autenticado" }, 401, cors)
    const { data: userData } = await admin.auth.getUser(token)
    const userId = userData?.user?.id
    if (!userId) return json({ ok: false, error: "no_autenticado" }, 401, cors)
    const { data: perfil } = await admin
      .from("perfiles").select("rol, activo").eq("user_id", userId).maybeSingle()
    autorizado = Boolean(perfil?.activo) && (perfil?.rol === "superadmin" || perfil?.rol === "admin")
    if (!autorizado) return json({ ok: false, error: "sin_permiso", mensaje: "No tenés permiso para generar este PDF." }, 403, cors)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: "datos_invalidos", mensaje: "Cuerpo inválido." }, 400, cors)
  }

  const modo = String(body.modo ?? "periodo")
  let bytes: Uint8Array
  let nombre: string

  if (modo === "cierre") {
    const cajaId = String(body.caja_id ?? "")
    if (!cajaId) return json({ ok: false, error: "datos_invalidos", mensaje: "Falta caja_id." }, 400, cors)
    const { data, error } = await admin.rpc("resumen_cierre_caja", { p_caja_id: cajaId })
    if (error || !data) {
      console.error("[generar-reporte-pdf] resumen_cierre_caja:", error)
      return json({ ok: false, error: "interno", mensaje: "No pudimos leer el cierre de esa caja." }, 500, cors)
    }
    bytes = await pdfCierre(data)
    nombre = `caja-${String(data.fecha).slice(0, 10)}.pdf`
  } else {
    const desde = String(body.desde ?? "")
    const hasta = String(body.hasta ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return json({ ok: false, error: "datos_invalidos", mensaje: "Fechas inválidas." }, 400, cors)
    }
    const { data, error } = await admin.rpc("reporte_resumen", { p_desde: desde, p_hasta: hasta })
    if (error || !data) {
      console.error("[generar-reporte-pdf] reporte_resumen:", error)
      return json({ ok: false, error: "interno", mensaje: "No pudimos leer los números del período." }, 500, cors)
    }
    bytes = await pdfPeriodo(data)
    nombre = `reporte-${desde}_${hasta}.pdf`
  }

  const { error: subidaError } = await admin.storage
    .from(BUCKET)
    .upload(nombre, bytes, { contentType: "application/pdf", upsert: true })
  if (subidaError) {
    console.error("[generar-reporte-pdf] subida:", subidaError)
    return json({ ok: false, error: "interno", mensaje: "No pudimos guardar el PDF." }, 500, cors)
  }

  const { data: firmada, error: firmaError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(nombre, VALIDEZ_URL_SEG)
  if (firmaError || !firmada?.signedUrl) {
    console.error("[generar-reporte-pdf] signed url:", firmaError)
    return json({ ok: false, error: "interno", mensaje: "No pudimos generar el link del PDF." }, 500, cors)
  }

  return json({ ok: true, url: firmada.signedUrl, nombre, expira_en: VALIDEZ_URL_SEG }, 200, cors)
})

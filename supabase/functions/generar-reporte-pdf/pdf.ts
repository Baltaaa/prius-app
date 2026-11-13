// Dibujo del PDF de Prius con pdf-lib (nov 2026, Tarea 4).
//
// Todo vectorial: no hay imágenes de gráficos, se dibujan con primitivas, así
// que el PDF pesa poco y se imprime nítido a cualquier tamaño.
//
// Legible en blanco y negro: ninguna serie se distingue SOLO por color. El
// amarillo Prius va siempre con su etiqueta escrita, y "sin factura" se dibuja
// con trama diagonal además del gris — impreso en B/N se sigue leyendo cuál
// es cuál.

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "npm:pdf-lib@1.17.1"
import fontkit from "npm:@pdf-lib/fontkit@1.1.1"

export const A4 = { ancho: 595.28, alto: 841.89 }
export const MARGEN = 42

export const COLOR = {
  tinta: rgb(0, 0, 0),
  tinta2: rgb(0.42, 0.42, 0.42),
  linea: rgb(0.85, 0.85, 0.85),
  superficie: rgb(0.96, 0.96, 0.95),
  oro: rgb(0.929, 0.631, 0),       // #ed a1 00 — amarillo Prius de los gráficos
  neutro: rgb(0.54, 0.54, 0.52),   // "sin factura"
  serie: [
    rgb(0.929, 0.631, 0),
    rgb(0.165, 0.471, 0.839),
    rgb(0.922, 0.408, 0.204),
    rgb(0.290, 0.227, 0.655),
    rgb(0.106, 0.686, 0.478),
  ],
}

// La fuente de marca se trae una sola vez por isolate. Es la variable de
// Google Fonts (OFL): pdf-lib embebe su instancia por defecto. Si la descarga
// falla, el PDF sale igual con Helvetica antes que no salir.
const URL_MANROPE = Deno.env.get("MANROPE_TTF_URL")
  || "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/manrope/Manrope%5Bwght%5D.ttf"
let manropeCache: Uint8Array | null | undefined

async function bytesManrope(): Promise<Uint8Array | null> {
  if (manropeCache !== undefined) return manropeCache
  try {
    const res = await fetch(URL_MANROPE, { signal: AbortSignal.timeout(6000) })
    manropeCache = res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch (err) {
    console.warn("[pdf] no se pudo traer Manrope, se usa Helvetica:", err)
    manropeCache = null
  }
  return manropeCache
}

export type Tipografia = { normal: PDFFont; fuerte: PDFFont; esManrope: boolean }

export async function crearDocumento(): Promise<{ pdf: PDFDocument; tipo: Tipografia }> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const bytes = await bytesManrope()
  if (bytes) {
    // Manrope variable: una sola cara. El "negrita" se simula dibujando el
    // texto dos veces con 0,3pt de corrimiento (ver `texto`), que a tamaño de
    // título se ve igual de bien y evita embeber una segunda fuente.
    const f = await pdf.embedFont(bytes, { subset: true })
    return { pdf, tipo: { normal: f, fuerte: f, esManrope: true } }
  }
  return {
    pdf,
    tipo: {
      normal: await pdf.embedFont(StandardFonts.Helvetica),
      fuerte: await pdf.embedFont(StandardFonts.HelveticaBold),
      esManrope: false,
    },
  }
}

type OpcTexto = {
  x: number; y: number; size?: number; color?: ReturnType<typeof rgb>
  fuerte?: boolean; maxAncho?: number; alinear?: "izq" | "der" | "centro"
}

/** Texto con recorte por ancho, alineación y negrita simulada si hace falta. */
export function texto(page: PDFPage, tipo: Tipografia, s: string, o: OpcTexto): number {
  const size = o.size ?? 9
  const font = o.fuerte ? tipo.fuerte : tipo.normal
  let txt = limpiar(s)
  if (o.maxAncho) txt = recortar(txt, font, size, o.maxAncho)
  const ancho = font.widthOfTextAtSize(txt, size)
  let x = o.x
  if (o.alinear === "der") x = o.x - ancho
  else if (o.alinear === "centro") x = o.x - ancho / 2
  const color = o.color ?? COLOR.tinta
  page.drawText(txt, { x, y: o.y, size, font, color })
  if (o.fuerte && tipo.esManrope) page.drawText(txt, { x: x + 0.3, y: o.y, size, font, color })
  return ancho
}

/**
 * pdf-lib (WinAnsi y la mayoría de las fuentes) no dibuja emojis ni algunos
 * símbolos: se sacan antes de escribir para que no reviente la generación.
 */
function limpiar(s: string): string {
  return String(s ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function recortar(s: string, font: PDFFont, size: number, max: number): string {
  if (font.widthOfTextAtSize(s, size) <= max) return s
  let corte = s
  while (corte.length > 1 && font.widthOfTextAtSize(`${corte}…`, size) > max) corte = corte.slice(0, -1)
  return `${corte}…`
}

export function linea(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color = COLOR.linea, grosor = 0.5) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: grosor, color })
}

/** Trama diagonal dentro de un rectángulo: lo que distingue SF impreso en B/N. */
export function trama(page: PDFPage, x: number, y: number, w: number, h: number, color = COLOR.tinta2) {
  const paso = 4
  for (let i = -h; i < w; i += paso) {
    const x1 = Math.max(x + i, x)
    const y1 = y + Math.max(0, -(i))
    const x2 = Math.min(x + i + h, x + w)
    const y2 = y + (x2 - (x + i))
    if (x2 <= x1) continue
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: Math.min(y2, y + h) }, thickness: 0.4, color })
  }
}

// ------------------------------------------------------------- encabezado

export async function encabezado(
  pdf: PDFDocument, page: PDFPage, tipo: Tipografia,
  { titulo, periodo, logoBytes }: { titulo: string; periodo: string; logoBytes?: Uint8Array | null },
) {
  const y = A4.alto - MARGEN
  let x = MARGEN
  if (logoBytes) {
    try {
      const img = await pdf.embedPng(logoBytes)
      page.drawImage(img, { x, y: y - 30, width: 30, height: 30 })
      x += 40
    } catch { /* el logo es decorativo: si no se puede embeber, sigue sin él */ }
  }
  texto(page, tipo, "PRIUS PLAYA GRANDE", { x, y: y - 10, size: 13, fuerte: true })
  texto(page, tipo, titulo, { x, y: y - 24, size: 10, color: COLOR.tinta2 })
  texto(page, tipo, periodo, { x: A4.ancho - MARGEN, y: y - 10, size: 10, fuerte: true, alinear: "der" })
  linea(page, MARGEN, y - 38, A4.ancho - MARGEN, y - 38, COLOR.tinta, 1)
  return y - 56
}

export function pie(page: PDFPage, tipo: Tipografia, n: number, total: number, generado: string) {
  linea(page, MARGEN, MARGEN + 16, A4.ancho - MARGEN, MARGEN + 16)
  texto(page, tipo, `Generado el ${generado}`, { x: MARGEN, y: MARGEN + 5, size: 7, color: COLOR.tinta2 })
  texto(page, tipo, `Página ${n} de ${total}`, { x: A4.ancho - MARGEN, y: MARGEN + 5, size: 7, color: COLOR.tinta2, alinear: "der" })
}

// ------------------------------------------------------------------ KPIs

export function tarjetasKpi(
  page: PDFPage, tipo: Tipografia, y: number,
  items: { label: string; valor: string; sub?: string }[],
) {
  const ancho = (A4.ancho - MARGEN * 2 - 8 * (items.length - 1)) / items.length
  const alto = 52
  items.forEach((it, i) => {
    const x = MARGEN + i * (ancho + 8)
    page.drawRectangle({ x, y: y - alto, width: ancho, height: alto, borderColor: COLOR.tinta, borderWidth: 0.6 })
    texto(page, tipo, it.label.toUpperCase(), { x: x + 8, y: y - 16, size: 6.5, color: COLOR.tinta2, maxAncho: ancho - 16 })
    texto(page, tipo, it.valor, { x: x + 8, y: y - 32, size: 12, fuerte: true, maxAncho: ancho - 16 })
    if (it.sub) texto(page, tipo, it.sub, { x: x + 8, y: y - 44, size: 6.5, color: COLOR.tinta2, maxAncho: ancho - 16 })
  })
  return y - alto - 18
}

export function titulo(page: PDFPage, tipo: Tipografia, s: string, y: number) {
  texto(page, tipo, s.toUpperCase(), { x: MARGEN, y, size: 8, fuerte: true })
  linea(page, MARGEN, y - 5, A4.ancho - MARGEN, y - 5, COLOR.tinta, 0.6)
  return y - 18
}

// -------------------------------------------------------------- gráficos

type Punto = { label: string; valor: number }

/** Barras verticales de una serie, con eje de base y el máximo rotulado. */
export function barras(page: PDFPage, tipo: Tipografia, y: number, datos: Punto[], alto = 110, fmt: (n: number) => string) {
  const w = A4.ancho - MARGEN * 2
  const base = y - alto
  const max = Math.max(...datos.map((d) => d.valor), 1)
  const paso = w / Math.max(datos.length, 1)
  const ancho = Math.min(paso * 0.6, 26)

  linea(page, MARGEN, base, MARGEN + w, base, COLOR.tinta, 0.6)
  texto(page, tipo, fmt(max), { x: MARGEN, y: y + 2, size: 6.5, color: COLOR.tinta2 })

  datos.forEach((d, i) => {
    const h = (d.valor / max) * (alto - 10)
    const x = MARGEN + i * paso + (paso - ancho) / 2
    if (h > 0) page.drawRectangle({ x, y: base, width: ancho, height: h, color: COLOR.oro })
    // Etiquetas del eje salteadas para que no se pisen.
    const cada = Math.ceil(datos.length / 12)
    if (i % cada === 0) {
      texto(page, tipo, d.label, { x: x + ancho / 2, y: base - 9, size: 6, color: COLOR.tinta2, alinear: "centro" })
    }
  })
  return base - 24
}

/** Apiladas F (relleno oro) sobre SF (gris con trama): se leen en B/N. */
export function barrasApiladas(
  page: PDFPage, tipo: Tipografia, y: number,
  datos: { label: string; f: number; sf: number }[], alto = 110, fmt: (n: number) => string,
) {
  const w = A4.ancho - MARGEN * 2
  const base = y - alto
  const max = Math.max(...datos.map((d) => d.f + d.sf), 1)
  const paso = w / Math.max(datos.length, 1)
  const ancho = Math.min(paso * 0.6, 26)

  linea(page, MARGEN, base, MARGEN + w, base, COLOR.tinta, 0.6)
  texto(page, tipo, fmt(max), { x: MARGEN, y: y + 2, size: 6.5, color: COLOR.tinta2 })

  datos.forEach((d, i) => {
    const x = MARGEN + i * paso + (paso - ancho) / 2
    const hSf = (d.sf / max) * (alto - 10)
    const hF = (d.f / max) * (alto - 10)
    if (hSf > 0) {
      page.drawRectangle({ x, y: base, width: ancho, height: hSf, color: rgb(0.88, 0.88, 0.87), borderColor: COLOR.neutro, borderWidth: 0.4 })
      trama(page, x, base, ancho, hSf)
    }
    // 2pt de aire entre rellenos apilados.
    if (hF > 0) page.drawRectangle({ x, y: base + hSf + (hSf > 0 ? 2 : 0), width: ancho, height: hF, color: COLOR.oro })
    const cada = Math.ceil(datos.length / 12)
    if (i % cada === 0) texto(page, tipo, d.label, { x: x + ancho / 2, y: base - 9, size: 6, color: COLOR.tinta2, alinear: "centro" })
  })

  // Leyenda: nunca solo color.
  const yl = base - 22
  page.drawRectangle({ x: MARGEN, y: yl, width: 8, height: 8, color: COLOR.oro })
  texto(page, tipo, "Con factura (F)", { x: MARGEN + 12, y: yl + 1, size: 7 })
  const x2 = MARGEN + 110
  page.drawRectangle({ x: x2, y: yl, width: 8, height: 8, color: rgb(0.88, 0.88, 0.87), borderColor: COLOR.neutro, borderWidth: 0.4 })
  trama(page, x2, yl, 8, 8)
  texto(page, tipo, "Sin factura (SF)", { x: x2 + 12, y: yl + 1, size: 7 })
  return yl - 16
}

/** Barras horizontales con el nombre a la izquierda y el monto a la derecha. */
export function barrasHorizontales(
  page: PDFPage, tipo: Tipografia, y: number,
  datos: { label: string; valor: number; color?: ReturnType<typeof rgb> }[],
  fmt: (n: number) => string, anchoTotal = A4.ancho - MARGEN * 2,
) {
  const max = Math.max(...datos.map((d) => d.valor), 1)
  const anchoBarra = anchoTotal - 230
  let cur = y
  datos.forEach((d, i) => {
    texto(page, tipo, d.label, { x: MARGEN, y: cur, size: 8, maxAncho: 120 })
    const x = MARGEN + 130
    page.drawRectangle({ x, y: cur - 1, width: anchoBarra, height: 7, color: COLOR.superficie })
    const w = (d.valor / max) * anchoBarra
    if (w > 0) page.drawRectangle({ x, y: cur - 1, width: w, height: 7, color: d.color ?? COLOR.serie[i % COLOR.serie.length] })
    texto(page, tipo, fmt(d.valor), { x: MARGEN + anchoTotal, y: cur, size: 8, alinear: "der" })
    cur -= 16
  })
  return cur - 6
}

/**
 * Dona con drawSvgPath. Cada porción lleva su etiqueta y su monto escritos al
 * costado, así que el color es apoyo y no la única pista.
 */
export function dona(
  page: PDFPage, tipo: Tipografia, y: number,
  datos: { label: string; valor: number }[], fmt: (n: number) => string,
) {
  const total = datos.reduce((a, d) => a + d.valor, 0)
  const r = 48
  const ri = 28
  const cx = MARGEN + r + 4
  const cy = y - r - 4

  if (total > 0) {
    let a0 = -Math.PI / 2
    datos.forEach((d, i) => {
      const a1 = a0 + (d.valor / total) * Math.PI * 2
      page.drawSvgPath(arco(r, ri, a0, a1), {
        x: cx,
        y: cy,
        color: COLOR.serie[i % COLOR.serie.length],
        borderColor: rgb(1, 1, 1),
        borderWidth: 1,
      })
      a0 = a1
    })
  }

  // Leyenda a la derecha: nombre, monto y porcentaje escritos.
  let cur = y - 10
  const xl = MARGEN + r * 2 + 24
  datos.forEach((d, i) => {
    page.drawRectangle({ x: xl, y: cur - 1, width: 7, height: 7, color: COLOR.serie[i % COLOR.serie.length] })
    texto(page, tipo, d.label, { x: xl + 12, y: cur, size: 8, maxAncho: 190 })
    texto(page, tipo, fmt(d.valor), { x: A4.ancho - MARGEN - 50, y: cur, size: 8, alinear: "der" })
    const p = total > 0 ? (d.valor / total) * 100 : 0
    texto(page, tipo, `${p.toFixed(1)}%`, { x: A4.ancho - MARGEN, y: cur, size: 8, color: COLOR.tinta2, alinear: "der" })
    cur -= 14
  })
  return Math.min(cy - r - 12, cur - 6)
}

/**
 * Sector de anillo como path SVG, en coordenadas LOCALES al centro de la
 * dona: pdf-lib pone el origen del path en el (x, y) que se le pasa y dibuja
 * con el eje Y hacia abajo, así que acá la altura va negada.
 */
function arco(r: number, ri: number, a0: number, a1: number): string {
  const p = (radio: number, a: number) => `${(radio * Math.cos(a)).toFixed(2)} ${(-radio * Math.sin(a)).toFixed(2)}`
  const grande = a1 - a0 > Math.PI ? 1 : 0
  // Con el eje Y invertido, el sentido de barrido del arco también se invierte.
  return [
    `M ${p(r, a0)}`,
    `A ${r} ${r} 0 ${grande} 0 ${p(r, a1)}`,
    `L ${p(ri, a1)}`,
    `A ${ri} ${ri} 0 ${grande} 1 ${p(ri, a0)}`,
    "Z",
  ].join(" ")
}

/** Barras de ocupación por tipo de unidad: "99 de 144" escrito al lado. */
export function ocupacionPorTipo(
  page: PDFPage, tipo: Tipografia, y: number,
  items: { tipo: string; ocupadas: number; total: number; pct: number | null }[],
) {
  let cur = y
  for (const it of items) {
    texto(page, tipo, it.tipo, { x: MARGEN, y: cur, size: 8, maxAncho: 100 })
    const x = MARGEN + 110
    const w = 220
    page.drawRectangle({ x, y: cur - 1, width: w, height: 8, color: COLOR.superficie, borderColor: COLOR.linea, borderWidth: 0.4 })
    const p = it.total > 0 ? it.ocupadas / it.total : 0
    if (p > 0) page.drawRectangle({ x, y: cur - 1, width: w * p, height: 8, color: COLOR.oro })
    texto(page, tipo, `${it.ocupadas} de ${it.total}`, { x: x + w + 10, y: cur, size: 8 })
    texto(page, tipo, it.pct == null ? "—" : `${it.pct}%`, { x: A4.ancho - MARGEN, y: cur, size: 8, fuerte: true, alinear: "der" })
    cur -= 16
  }
  return cur - 6
}

// ------------------------------------------------------------------ tabla

export function tabla(
  page: PDFPage, tipo: Tipografia, y: number,
  columnas: { titulo: string; ancho: number; der?: boolean }[],
  filas: string[][],
) {
  const xs: number[] = []
  let x = MARGEN
  for (const c of columnas) { xs.push(x); x += c.ancho }

  columnas.forEach((c, i) => {
    texto(page, tipo, c.titulo.toUpperCase(), {
      x: c.der ? xs[i] + c.ancho : xs[i], y, size: 6.5, fuerte: true, color: COLOR.tinta2,
      alinear: c.der ? "der" : "izq", maxAncho: c.ancho - 4,
    })
  })
  let cur = y - 4
  linea(page, MARGEN, cur, A4.ancho - MARGEN, cur, COLOR.tinta, 0.5)
  cur -= 11

  for (const f of filas) {
    columnas.forEach((c, i) => {
      texto(page, tipo, f[i] ?? "", {
        x: c.der ? xs[i] + c.ancho : xs[i], y: cur, size: 7.5,
        alinear: c.der ? "der" : "izq", maxAncho: c.ancho - 4,
      })
    })
    cur -= 4
    linea(page, MARGEN, cur, A4.ancho - MARGEN, cur, rgb(0.92, 0.92, 0.92), 0.3)
    cur -= 11
  }
  return cur - 4
}

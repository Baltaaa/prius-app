import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'
import { mkdirSync, writeFileSync } from 'node:fs'

// Comprobantes: la página no scrollea nunca, la preview entra escalada y centrada,
// y la impresión (emulada) solo suma la marca de agua. Solo lectura: la emisión
// (rpc fn_emitir_comprobante) se simula en el navegador, nunca llega a la base.
const TODOS = '360x640,390x844,430x932,768x1024,834x1194,1024x768,1180x820,1280x800,1366x768,1440x900,1920x1080'
const ANCHOS = (process.env.ANCHOS || TODOS).split(',').map((a) => a.split('x').map(Number) as [number, number])
const OUT = process.env.OUT_IMPRESION || 'design/rebrand-shots/comprobantes'
const TAG = process.env.TAG || 'new'

test('comprobantes: sin scroll, preview entera, escalada y centrada', async ({ page }) => {
  test.skip(TAG === 'old', 'la versión anterior no tiene preview escalada')
  test.setTimeout(600_000)
  await login(page)
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/comprobantes')
    await esperarCarga(page)
    await page.waitForSelector('[data-comprobante-hoja]')
    await page.waitForTimeout(400)
    const d = await page.evaluate(() => {
      const de = document.documentElement
      const main = document.getElementById('app-main-scroll')!
      const area = document.querySelector('[data-comprobante-area]') as HTMLElement
      const hoja = document.querySelector('[data-comprobante-hoja]') as HTMLElement
      const doc = hoja.firstElementChild as HTMLElement
      const a = area.getBoundingClientRect()
      const r = hoja.getBoundingClientRect()
      const nat = { w: doc.offsetWidth, h: doc.offsetHeight }
      const zona = (document.querySelector('.pbh') as HTMLElement).getBoundingClientRect().bottom
      const nav = [...document.querySelectorAll('nav')].find((n) => { const r = n.getBoundingClientRect(); return r.height > 0 && r.width > 0 && r.top > innerHeight / 2 }) as HTMLElement | undefined
      return {
        docScrollW: de.scrollWidth, docScrollH: de.scrollHeight, iw: innerWidth, ih: innerHeight,
        mainScrollW: main.scrollWidth, mainClientW: main.clientWidth, mainScrollH: main.scrollHeight, mainClientH: main.clientHeight,
        dentro: r.left >= a.left - 0.5 && r.right <= a.right + 0.5 && r.top >= a.top - 0.5 && r.bottom <= a.bottom + 0.5,
        dx: Math.abs((r.left + r.width / 2) - (a.left + a.width / 2)), dy: Math.abs((r.top + r.height / 2) - (a.top + a.height / 2)),
        proporcion: Math.abs(r.width / r.height - nat.w / nat.h), escala: r.width / nat.w,
        bajoZona: r.top >= zona - 0.5, navTop: nav ? nav.getBoundingClientRect().top : null, hojaBottom: r.bottom,
        areaH: a.height, areaW: a.width,
      }
    })
    const donde = `${w}x${h} ${JSON.stringify(d)}`
    expect(d.docScrollW, `scrollWidth de la página ${donde}`).toBe(d.iw)
    expect(d.docScrollH, `scrollHeight de la página ${donde}`).toBe(d.ih)
    expect(d.mainScrollW, `main horizontal ${donde}`).toBeLessThanOrEqual(d.mainClientW)
    expect(d.mainScrollH, `main vertical ${donde}`).toBeLessThanOrEqual(d.mainClientH + 1)
    expect(d.dentro, `la hoja entra completa ${donde}`).toBe(true)
    expect(d.dx, `centrada horizontal ${donde}`).toBeLessThan(2)
    expect(d.dy, `centrada vertical ${donde}`).toBeLessThan(2)
    expect(d.proporcion, `proporción real ${donde}`).toBeLessThan(0.01)
    expect(d.bajoZona, `debajo de la zona sticky ${donde}`).toBe(true)
    if (w < 768 && d.navTop != null) expect(d.hojaBottom, `sobre la bottom nav ${donde}`).toBeLessThanOrEqual(d.navTop)
    // hoja = una sola marca de agua, detrás del contenido
    expect(await page.locator('[data-comprobante-hoja] .cd-watermark').count()).toBe(1)
    if (w >= 1024) {
      await expect(page.getByText('Pagos registrados — recibo individual')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible()
    } else {
      await expect(page.getByRole('button', { name: /^Pagos \(\d+\)/ })).toBeVisible()
      const imp = (await page.getByRole('button', { name: 'Imprimir' }).boundingBox())!
      expect(imp.height, `Imprimir >= 44px ${donde}`).toBeGreaterThanOrEqual(44)
    }
  }
})

test('comprobantes mobile: lista de pagos en sheet y visor con zoom', async ({ page }) => {
  test.skip(TAG === 'old')
  await login(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/comprobantes')
  await esperarCarga(page)
  await page.waitForSelector('[data-comprobante-hoja]')
  // bottom sheet con la lista
  await page.getByRole('button', { name: /^Pagos \(\d+\)/ }).click()
  await expect(page.getByRole('heading', { name: 'Pagos registrados' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Pagos registrados' })).toHaveCount(0)
  // visor: abre al tocar la preview, encuadra y centra, cierra con el botón
  await page.getByRole('button', { name: 'Ver el comprobante a pantalla completa' }).click()
  const visor = page.getByRole('dialog', { name: 'Comprobante a pantalla completa' })
  await expect(visor).toBeVisible()
  const est = () => visor.locator('[data-zoom-pan]').evaluate((c) => {
    const k = c.firstElementChild as HTMLElement
    const m = new DOMMatrix(getComputedStyle(k).transform)
    return { s: m.a, x: m.e, y: m.f, cw: c.clientWidth, ch: c.clientHeight, w: k.offsetWidth, h: k.offsetHeight }
  })
  await page.waitForTimeout(300)
  const e0 = await est()
  const fit = Math.min((e0.cw - 8) / e0.w, (e0.ch - 8) / e0.h)
  expect(Math.abs(e0.s - fit)).toBeLessThan(0.01)
  expect(Math.abs(e0.x - (e0.cw - e0.w * e0.s) / 2)).toBeLessThan(1.5)
  expect(Math.abs(e0.y - (e0.ch - e0.h * e0.s) / 2)).toBeLessThan(1.5)
  // doble tap acerca; "pinch" hacia adentro vuelve exactamente al encuadre
  const cont = (await visor.locator('[data-zoom-pan]').boundingBox())!
  const cx = cont.x + cont.width / 2, cy = cont.y + cont.height / 2
  await page.mouse.dblclick(cx, cy)
  await page.waitForTimeout(600)
  expect((await est()).s).toBeGreaterThan(fit * 1.8)
  await visor.getByRole('button', { name: 'Cerrar' }).click()
  await expect(visor).toHaveCount(0)
})

// ───────────────────────── impresión emulada ─────────────────────────
// La impresión real pasa por un iframe + window.print(): se captura el HTML que
// se mandaría a imprimir y se lo renderiza en medio "print" (A4). Con TAG=old|new
// y E2E_BASE_URL apuntando a la versión anterior / actual se compara píxel a píxel.
for (const tipo of ['estado_cuenta', 'recibo']) {
  test(`impresión emulada (${tipo}) — ${TAG}`, async ({ page, context }) => {
    test.setTimeout(180_000)
    mkdirSync(OUT, { recursive: true })
    // la emisión del número correlativo (una escritura) se simula acá: nunca llega a la base
    await page.route('**/rest/v1/rpc/fn_emitir_comprobante', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ numero: 123 }) }))
    await login(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/app/comprobantes')
    await esperarCarga(page)
    // imprimirDocumento monta el documento en un iframe oculto y llama a print():
    // se toma el HTML de ese iframe cuando ya renderizó (con sus imágenes) y se lo
    // vuelve a dibujar en medio "print".
    const adjunto = page.waitForEvent('frameattached')
    if (tipo === 'estado_cuenta') {
      await page.getByRole('button', { name: /Imprimir/ }).first().click()
    } else {
      await page.getByRole('button', { name: 'Emitir recibo de este pago' }).first().click()
    }
    const marco = await adjunto
    await marco.waitForFunction(() => document.querySelector('.cd-root') && [...document.images].every((i) => i.complete), null, { timeout: 15_000 })
    const html = await marco.evaluate(() => document.documentElement.outerHTML)
    writeFileSync(`${OUT}/${TAG}-${tipo}.html`, html)
    const base = new URL(page.url()).origin
    const pdfPage = await context.newPage()
    await pdfPage.setViewportSize({ width: 794, height: 1123 })
    await pdfPage.emulateMedia({ media: 'print' })
    await pdfPage.goto(`${base}/login`)
    for (const variante of ['completa', 'sin-marca']) {
      await pdfPage.setContent(html.replace('<head>', `<head><base href="${base}/">`), { waitUntil: 'load' })
      await pdfPage.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r })))))
      // la hora de emisión cambia en cada corrida: se oculta en las dos para poder comparar
      await pdfPage.addStyleTag({ content: '.cd-emision { visibility: hidden !important; }' })
      if (variante === 'sin-marca') {
        // solo para comparar: sin la marca de agua y sin el ícono/emoji de la unidad (que cambió a pedido)
        await pdfPage.addStyleTag({ content: '.cd-watermark, .cd-unidad-emoji, .cd-unidad-icon { visibility: hidden !important; }' })
      }
      await pdfPage.screenshot({ path: `${OUT}/${TAG}-${tipo}-${variante}.png` })
    }
    await pdfPage.pdf({ path: `${OUT}/${TAG}-${tipo}.pdf`, preferCSSPageSize: true, printBackground: true }).catch(() => {})
    // la hoja trae las dos copias A4 y, en la versión nueva, una marca de agua por copia
    const marcas = await pdfPage.evaluate(() => document.querySelectorAll('.cd-watermark').length)
    if (TAG !== 'old') expect(marcas).toBe(2)
    const css = await pdfPage.evaluate(() => {
      const w = document.querySelector('.cd-watermark') as HTMLElement | null
      if (!w) return null
      const s = getComputedStyle(w)
      const root = w.parentElement!.getBoundingClientRect()
      return { opacity: s.opacity, filter: s.filter, z: s.zIndex, ancho: w.getBoundingClientRect().width / root.width, adjust: s.getPropertyValue('print-color-adjust') || s.getPropertyValue('-webkit-print-color-adjust') }
    })
    if (TAG !== 'old') {
      expect(Number(css!.opacity)).toBeGreaterThanOrEqual(0.05)
      expect(Number(css!.opacity)).toBeLessThanOrEqual(0.06)
      expect(css!.filter).toContain('grayscale')
      expect(css!.ancho).toBeGreaterThan(0.55)
      expect(css!.ancho).toBeLessThan(0.6)
      expect(css!.z).toBe('-1')
      expect(css!.adjust).toBe('exact')
    }
    await pdfPage.close()
  })
}

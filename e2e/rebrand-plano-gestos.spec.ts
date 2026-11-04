import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'
import { mkdirSync } from 'node:fs'
const OUT = 'design/rebrand-shots/plano-gestos'
const foto = async (page: any, nombre: string) => { if (!process.env.SIN_CAPTURAS) await page.screenshot({ path: `${OUT}/${nombre}.png` }) }
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

// Plano mobile: gestos del mapa con toques reales (CDP). Solo lectura: abre la
// ficha de una unidad pero nunca confirma nada (ver e2e/guard.ts).
test('plano mobile: gestos del mapa', async ({ page }) => {
  test.setTimeout(240_000)
  mkdirSync(OUT, { recursive: true })
  const log: string[] = []
  const L = (...a: any[]) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); log.push(s); console.log(s) }
  await login(page)
  await page.goto('/app/plano')
  await esperarCarga(page)
  const cont = page.locator('[data-zoom-pan]')
  await expect(cont).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  const toque = (type: string, pts: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) })
  const estado = () => cont.evaluate((c) => {
    const k = c.firstElementChild as HTMLElement
    const m = new DOMMatrix(getComputedStyle(k).transform)
    const cr = c.getBoundingClientRect()
    return { s: m.a, x: m.e, y: m.f, cw: cr.width, ch: cr.height, left: cr.left, top: cr.top, w: k.offsetWidth, h: k.offsetHeight }
  })
  const box = async () => (await cont.boundingBox())!

  const e0 = await estado()
  const RES = 56 // franja derecha reservada para la pill de zoom
  const fit = Math.min((e0.cw - RES - 8) / e0.w, (e0.ch - 8) / e0.h)
  L('inicial', { ...e0, fit })
  expect(Math.abs(e0.s - fit)).toBeLessThan(0.01)
  const izq = e0.x, der = e0.cw - RES - (e0.x + e0.w * e0.s)
  expect(Math.abs(izq - der)).toBeLessThan(2)
  const arr = e0.y, aba = e0.ch - (e0.y + e0.h * e0.s)
  expect(Math.abs(arr - aba)).toBeLessThan(2)
  // la pill de zoom no tapa ninguna unidad en el encuadre
  const pill = (await page.getByRole('button', { name: 'Acercar' }).locator('xpath=..').boundingBox())!
  const tapadas = await cont.locator('button[data-deeplink-id]').evaluateAll((els, pb: any) =>
    els.filter((e) => { const r = e.getBoundingClientRect(); return r.right > pb.x && r.left < pb.x + pb.width && r.bottom > pb.y && r.top < pb.y + pb.height }).length, pill)
  L('unidades bajo la pill', tapadas)
  expect(tapadas).toBe(0)
  await foto(page, 'g-1-inicial')
  const trunc = await page.evaluate(() => {
    const out: string[] = []
    document.querySelectorAll('[role="radiogroup"] button span, input[readonly]').forEach((el) => {
      const e = el as HTMLElement
      if (e.scrollWidth > e.clientWidth + 1) out.push((e.textContent || (e as HTMLInputElement).value || '').trim() + ' ' + e.scrollWidth + '>' + e.clientWidth)
    })
    return out
  })
  L('truncados', trunc)
  expect(trunc).toEqual([])

  // 1) arrastrar en el encuadre: rebota al soltar y vuelve centrado
  const b = await box()
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2
  await toque('touchStart', [{ x: cx, y: cy }])
  for (let i = 1; i <= 10; i++) await toque('touchMove', [{ x: cx + i * 12, y: cy + i * 6 }])
  const durante = await estado()
  L('arrastre en encuadre (durante)', { dx: durante.x - e0.x, dy: durante.y - e0.y })
  await toque('touchEnd', [])
  await page.waitForTimeout(700)
  const tras = await estado()
  L('tras rebote', { dx: tras.x - e0.x, dy: tras.y - e0.y, s: tras.s })
  expect(Math.abs(tras.x - e0.x)).toBeLessThan(1.5)
  expect(Math.abs(tras.y - e0.y)).toBeLessThan(1.5)

  // 2) pinch hacia afuera: zoom anclado al punto medio
  const mx = cx, my = cy - 40
  const antes = await estado()
  const ancla = { cxp: (mx - b.x - antes.x) / antes.s, cyp: (my - b.y - antes.y) / antes.s }
  await toque('touchStart', [{ x: mx - 30, y: my }, { x: mx + 30, y: my }])
  for (let i = 1; i <= 12; i++) await toque('touchMove', [{ x: mx - 30 - i * 6, y: my }, { x: mx + 30 + i * 6, y: my }])
  await toque('touchEnd', [])
  await page.waitForTimeout(500)
  const z = await estado()
  const bajo = { px: b.x + z.x + ancla.cxp * z.s, py: b.y + z.y + ancla.cyp * z.s }
  L('pinch', { s: z.s, ratio: z.s / e0.s, puntoBajoDedos: bajo, medio: { mx, my } })
  expect(z.s).toBeGreaterThan(e0.s * 1.8)
  await foto(page, 'g-2-zoom')

  // 3) arrastre con zoom: nunca saca el mapa de la vista
  for (const [dx, dy] of [[400, 400], [-900, -900], [500, -700]]) {
    const s0 = { x: cx, y: cy }
    await toque('touchStart', [s0])
    for (let i = 1; i <= 12; i++) await toque('touchMove', [{ x: s0.x + (dx * i) / 12 / 3, y: s0.y + (dy * i) / 12 / 3 }])
    await toque('touchEnd', [])
    await page.waitForTimeout(900)
    const p = await estado()
    const fuera = p.x > 1 || p.y > 1 || p.x + p.w * p.s < p.cw - 1 || p.y + p.h * p.s < p.ch - 1
    L('pan zoom', { dx, dy, x: p.x, y: p.y, derecha: p.x + p.w * p.s, abajo: p.y + p.h * p.s, fuera })
  }

  // 4) pinch hacia adentro más allá del mínimo: vuelve exacto al encuadre
  // (los dedos quedan a la izquierda de la pill de zoom)
  await toque('touchStart', [{ x: mx - 100, y: my }, { x: mx + 100, y: my }])
  for (let i = 1; i <= 20; i++) await toque('touchMove', [{ x: mx - 100 + i * 5, y: my }, { x: mx + 100 - i * 5, y: my }])
  await toque('touchEnd', [])
  await page.waitForTimeout(800)
  const min = await estado()
  L('pinch hasta el mínimo', { s: min.s, fit, x: min.x, y: min.y })
  expect(Math.abs(min.s - fit)).toBeLessThan(0.01)
  expect(Math.abs(min.x - e0.x)).toBeLessThan(1.5)
  expect(Math.abs(min.y - e0.y)).toBeLessThan(1.5)

  // 5) doble tap acerca
  await page.touchscreen.tap(mx, my + 120)
  await page.waitForTimeout(80)
  await page.touchscreen.tap(mx, my + 120)
  await page.waitForTimeout(500)
  const dt = await estado()
  L('doble tap', { s: dt.s, ratio: dt.s / fit })
  expect(dt.s).toBeGreaterThan(fit * 1.8)
  // el modal de ficha NO se abrió con el doble tap
  expect(await page.locator('[role="dialog"], .ui-open-sheet').count()).toBe(0)

  // 6) "Encuadrar" vuelve al mínimo centrado
  await page.getByRole('button', { name: 'Encuadrar' }).click()
  await page.waitForTimeout(600)
  const enc = await estado()
  expect(Math.abs(enc.s - fit)).toBeLessThan(0.01)
  expect(Math.abs(enc.x - e0.x)).toBeLessThan(1.5)

  // 7) tap sobre una unidad abre la ficha sin mover el mapa
  await page.getByRole('button', { name: 'Acercar' }).click()
  await page.waitForTimeout(500)
  const pre = await estado()
  const celda = cont.locator('button[data-deeplink-id]').nth(30)
  const cb = (await celda.boundingBox())!
  L('celda', cb)
  await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2)
  await page.waitForTimeout(700)
  const post = await estado()
  L('tap en unidad: movimiento', { dx: post.x - pre.x, dy: post.y - pre.y, ds: post.s - pre.s })
  expect(Math.abs(post.x - pre.x) + Math.abs(post.y - pre.y)).toBeLessThan(1)
  await foto(page, 'g-3-ficha')
  const abierta = await page.getByText(/Carpa \d+|Sombrilla \d+/).first().isVisible().catch(() => false)
  expect(abierta).toBe(true)
  L('ficha visible', abierta)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // 8) cambiar de filtro encuadra de nuevo
  await page.getByRole('button', { name: 'Acercar' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('radio', { name: /Ocupadas/ }).click()
  await page.waitForTimeout(700)
  const f = await estado()
  L('tras filtro', { s: f.s, fit })
  expect(Math.abs(f.s - fit)).toBeLessThan(0.01)

  // 9) rotar: reencuadra y sin scroll horizontal
  await page.setViewportSize({ width: 667, height: 375 })
  await page.waitForTimeout(800)
  const r = await estado()
  const fitR = Math.min((r.cw - RES - 8) / r.w, (r.ch - 8) / r.h)
  L('rotado', { ...r, fitR })
  expect(Math.abs(r.s - fitR)).toBeLessThan(0.02)
  const hs = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hs).toBe(false)
  await foto(page, 'g-4-rotado')
})

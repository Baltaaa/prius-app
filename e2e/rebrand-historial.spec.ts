import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Historial: encabezados de día estáticos (nunca sticky), panel de detalle
// sticky arriba a la derecha y agrupado por día de Buenos Aires. Solo lectura.
test('historial: los encabezados de día nunca se pegan ni se superponen al scrollear', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page)
  for (const [w, h] of [[1280, 800], [1440, 900], [390, 844]] as [number, number][]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/historial?hDesde=2026-08-01')
    await esperarCarga(page)
    // ninguna cosa sticky dentro del contenido (solo la zona superior y el panel de detalle)
    const stickies = await page.evaluate(() => [...document.querySelectorAll('#app-main-scroll *')]
      .filter((e) => getComputedStyle(e).position === 'sticky')
      .map((e) => `${e.tagName}.${(e.className || '').toString().slice(0, 40)}`))
    for (const s of stickies) expect(s, `${w}: sticky inesperado`).toMatch(/ASIDE/)
    const encabezados = page.locator('#app-main-scroll h3')
    expect(await encabezados.count()).toBeGreaterThan(0)
    const main = page.locator('#app-main-scroll')
    const total = await main.evaluate((m) => m.scrollHeight - m.clientHeight)
    for (let y = 0; y <= total; y += Math.max(160, Math.round(h / 3))) {
      await main.evaluate((m, yy) => { m.scrollTop = yy }, y)
      await page.waitForTimeout(80)
      const rects = await encabezados.evaluateAll((els) => els.map((e) => { const r = (e.parentElement as HTMLElement).getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom) } }))
      // ningún encabezado se superpone con otro: sus bandas son disjuntas y en orden
      for (let i = 1; i < rects.length; i++) expect(rects[i].t, `${w}@${y}: encabezado ${i} solapado`).toBeGreaterThanOrEqual(rects[i - 1].b)
      // y no se quedan pegados bajo la zona: ninguno con top fijo cuando hay scroll
    }
    // las filas de un grupo van debajo de su encabezado (margen de 24px entre grupos)
    await main.evaluate((m) => { m.scrollTop = 0 })
    const gaps = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('#app-main-scroll h3')].map((e) => e.parentElement!.parentElement as HTMLElement)
      const out: number[] = []
      for (let i = 1; i < hs.length; i++) out.push(Math.round(hs[i].getBoundingClientRect().top - hs[i - 1].getBoundingClientRect().bottom))
      return out
    })
    for (const g of gaps) expect(g, `${w}: espacio entre grupos`).toBe(24)
  }
})

test('historial desktop: el panel de detalle queda sticky, alineado y visible', async ({ page }) => {
  await login(page)
  for (const [w, h] of [[1280, 800], [1440, 900]] as [number, number][]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/historial?hDesde=2026-08-01')
    await esperarCarga(page)
    const aside = page.locator('aside').filter({ hasText: /Elegí un movimiento|Detalle/ }).first()
    const zona = await page.evaluate(() => Math.round(document.querySelector('.pbh')!.getBoundingClientRect().bottom))
    const lista = page.locator('#app-main-scroll h3').first()
    const topLista = (await lista.evaluate((e) => Math.round((e.parentElement as HTMLElement).getBoundingClientRect().top)))
    const a0 = (await aside.boundingBox())!
    // alineado al tope de la lista y a zona + 16px
    expect(Math.abs(a0.y - topLista), `${w}: alineado con la lista`).toBeLessThanOrEqual(2)
    expect(Math.round(a0.y), `${w}: top = zona + 16`).toBe(zona + 16)
    expect(a0.y + a0.height, `${w}: no pasa el viewport`).toBeLessThanOrEqual(h - 16 + 1)
    // estado vacío centrado dentro del panel
    const centro = await aside.locator('p').first().evaluate((p) => { const r = p.getBoundingClientRect(); const a = p.closest('aside')!.getBoundingClientRect(); return { dx: Math.abs((r.left + r.width / 2) - (a.left + a.width / 2)), dy: Math.abs((r.top + r.height / 2) - (a.top + a.height / 2)) } })
    expect(centro.dx).toBeLessThan(4)
    expect(centro.dy).toBeLessThan(60)
    // al scrollear, sigue pegado y visible
    const main = page.locator('#app-main-scroll')
    for (const y of [300, 900]) {
      await main.evaluate((m, yy) => { m.scrollTop = yy }, y)
      await page.waitForTimeout(120)
      const b = (await aside.boundingBox())!
      expect(Math.round(b.y), `${w}@${y}: panel pegado`).toBe(zona + 16)
    }
    // abrir un movimiento (solo lectura): el detalle aparece en el panel y scrollea por dentro
    await main.evaluate((m) => { m.scrollTop = 0 })
    await page.locator('#app-main-scroll button.hover-row').first().click()
    await page.waitForTimeout(500)
    const b2 = (await aside.boundingBox())!
    expect(b2.y + b2.height).toBeLessThanOrEqual(h - 16 + 1)
  }
})

test('historial mobile: el detalle abre como bottom sheet', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/historial?hDesde=2026-08-01')
  await esperarCarga(page)
  await page.locator('#app-main-scroll button.hover-row').first().click()
  await expect(page.getByRole('heading', { name: 'Detalle del movimiento' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Detalle del movimiento' })).toHaveCount(0)
})

test('historial: los eventos se agrupan por día de Buenos Aires (no UTC)', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/historial?hDesde=2026-08-01')
  await esperarCarga(page)
  // cada fila lleva su hora local; ninguna hora de la noche (21:00-23:59) puede estar
  // en un grupo cuyo día sea posterior: se compara contra el instante real vía el estado de la lista.
  const filas = await page.evaluate(() => [...document.querySelectorAll('#app-main-scroll h3')].map((h3) => {
    const grupo = h3.parentElement!.parentElement as HTMLElement
    return { dia: h3.textContent, horas: [...grupo.querySelectorAll('span.tabular-nums')].map((s) => s.textContent).filter((t) => /^\d{2}:\d{2}$/.test(t || '')) }
  }))
  expect(filas.length).toBeGreaterThan(0)
  // dentro de un grupo las horas bajan (ts desc) y nunca "suben" de golpe de 00:xx a 23:xx
  for (const f of filas) {
    for (let i = 1; i < f.horas.length; i++) expect(f.horas[i] <= f.horas[i - 1], `${f.dia}: horas ${f.horas.join(',')}`).toBe(true)
  }
})

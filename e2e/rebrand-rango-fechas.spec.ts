import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Chip de rango de fechas de Reportes: en mobile abre un bottom sheet con los dos
// pickers centrados y a ancho completo (nunca un popover anclado); en desktop sigue
// siendo un popover anclado al chip. Solo lectura.
for (const [w, h] of [[360, 740], [390, 844], [430, 932]] as [number, number][]) {
  test(`reportes ${w}: el sheet de rango muestra los pickers centrados y a ancho completo`, async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/reportes')
    await esperarCarga(page)
    await page.getByRole('button', { name: /^Rango de fechas/ }).first().click()
    const picker = page.locator('[data-rango-picker]')
    await expect(picker).toBeVisible()
    await page.waitForTimeout(500) // fin de la animación del sheet

    const m = await page.evaluate(() => {
      const p = document.querySelector('[data-rango-picker] .rdp-root') as HTMLElement
      const r = p.getBoundingClientRect()
      const sheet = p.closest('[class*="rounded-t-card"]') as HTMLElement
      const s = sheet.getBoundingClientRect()
      return { l: r.left, r: r.right, w: r.width, sl: s.left, sr: s.right, sb: s.bottom, vw: innerWidth, vh: innerHeight,
        scrollX: document.documentElement.scrollWidth - innerWidth,
        popovers: [...document.querySelectorAll('.dp-prius')].filter((e) => !e.hasAttribute('data-rango-picker')).length }
    })
    expect(Math.abs((m.l + m.r) / 2 - m.vw / 2), 'centrado horizontal').toBeLessThanOrEqual(1)
    expect(m.w, 'ancho completo (gutter 16px)').toBeGreaterThanOrEqual(m.vw - 32 - 4)
    expect(m.l).toBeGreaterThanOrEqual(0)
    expect(m.r).toBeLessThanOrEqual(m.vw)
    expect(m.sl).toBe(0); expect(m.sr).toBe(m.vw) // el sheet ocupa todo el ancho
    expect(m.sb).toBeLessThanOrEqual(m.vh + 1)
    expect(m.scrollX, 'sin scroll horizontal').toBeLessThanOrEqual(0)
    expect(m.popovers, 'ningún calendario anclado como popover').toBe(0)

    // Desde -> pasa solo a Hasta
    await expect(page.getByRole('button', { name: /^Desde/ })).toHaveAttribute('aria-pressed', 'true')
    await picker.locator('button.rdp-day_button:not([disabled])').nth(9).click()
    await expect(page.getByRole('button', { name: /^Hasta/ })).toHaveAttribute('aria-pressed', 'true')
    await picker.locator('button.rdp-day_button:not([disabled])').last().click()
    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(picker).toHaveCount(0)
  })
}

test('reportes 1440: en desktop el rango sigue siendo un popover anclado al chip', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/reportes')
  await esperarCarga(page)
  const chip = page.getByRole('button', { name: /^Rango de fechas/ }).first()
  await chip.click()
  await expect(page.locator('[data-rango-picker]')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: /Rango de fechas/ })).toBeVisible()
  const [c, d] = await Promise.all([chip.boundingBox(), page.getByRole('dialog', { name: /Rango de fechas/ }).boundingBox()])
  expect(Math.abs(d!.x - c!.x)).toBeLessThan(40)
  expect(d!.y).toBeGreaterThanOrEqual(c!.y + c!.height - 4)
})

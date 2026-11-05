import { test, expect, login } from './fixtures'

// Búsqueda global del topbar: el dropdown vive en un portal fixed, SIEMPRE
// debajo del input y entero dentro del viewport. Solo lectura (guard activo).
const ANCHOS = [[1024, 768], [1280, 800], [1440, 900], [1920, 1080]]
const RUTAS = ['/app/caja', '/app/clientes', '/app/home']
const TEXTOS = ['a', 'ag', 'agu', 'aguer', 'agu']

for (const [w, h] of ANCHOS) {
  test(`busqueda-global ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await login(page)
    for (const ruta of RUTAS) {
      await page.goto(ruta)
      await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 })
      await page.waitForTimeout(1000)
      const input = page.getByPlaceholder(/Búsqueda inteligente|^Buscar$/).first()
      await expect(input).toBeVisible()
      for (const n of [1, 2, 5]) {
        await input.fill('')
        await input.fill('aguer'.slice(0, n).padEnd(n, 'a'))
        const panel = page.locator('[data-popover-anclado]').first()
        await expect(panel).toBeVisible()
        await page.waitForTimeout(500)
        const ib = (await input.boundingBox())!
        const pb = (await panel.boundingBox())!
        const tag = `${ruta} ${w} n=${n}`
        expect(pb.y, `${tag}: panel debajo del input`).toBeGreaterThanOrEqual(ib.y + ib.height + 7)
        expect(pb.y + pb.height, `${tag}: dentro del viewport`).toBeLessThanOrEqual(h)
        expect(pb.x, `${tag}: izquierda`).toBeGreaterThanOrEqual(0)
        expect(pb.x + pb.width, `${tag}: derecha`).toBeLessThanOrEqual(w)
        expect(pb.width, `${tag}: ancho mínimo`).toBeGreaterThanOrEqual(359)
        expect(ib.y, `${tag}: input dentro`).toBeGreaterThanOrEqual(0)
        await expect(input, `${tag}: foco`).toBeFocused()
        if (n === 1) await expect(panel).toContainText('mínimo 2 caracteres')
      }
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-popover-anclado]')).toHaveCount(0)
    }
  })
}

test('popovers de topbar: perfil y notificaciones en portal, debajo del ancla y alcanzables con el mouse', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  await page.goto('/app/home')
  await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1000)
  for (const label of ['Menú de usuario', 'Notificaciones']) {
    const ancla = page.getByLabel(label)
    await ancla.hover()
    const panel = page.locator('[data-popover-anclado]').first()
    await expect(panel).toBeVisible()
    const ab = (await ancla.boundingBox())!
    const pb = (await panel.boundingBox())!
    expect(pb.y).toBeGreaterThanOrEqual(ab.y + ab.height)
    expect(pb.y + pb.height).toBeLessThanOrEqual(800)
    expect(pb.x + pb.width).toBeLessThanOrEqual(1280)
    // cruzar el hueco hacia el panel no lo cierra
    await page.mouse.move(pb.x + pb.width / 2, pb.y + 20, { steps: 8 })
    await page.waitForTimeout(500)
    await expect(panel).toBeVisible()
    await page.mouse.move(600, 500)
    await expect(page.locator('[data-popover-anclado]')).toHaveCount(0)
  }
})

import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Smoke del modo oscuro (solo lectura): los dos temas en las pantallas principales, sin flash al
// recargar, mapa del plano en hoja clara e impresión siempre clara. Corre con
// playwright.rebrand.config.ts (guard de requests, sin teardown).
const CANVAS = { claro: 'rgb(248, 247, 242)', oscuro: 'rgb(14, 14, 13)' }
const RUTAS = ['/app/home', '/app/plano', '/app/caja', '/app/reservas', '/app/clientes', '/app/perfil']

for (const tema of ['claro', 'oscuro'] as const) {
  test(`tema ${tema}`, async ({ page }) => {
    test.setTimeout(240_000)
    const errores: string[] = []
    page.on('pageerror', (e) => errores.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|tema-inicial/.test(m.text())) errores.push(m.text()) })
    await page.addInitScript((t) => { try { localStorage.setItem('prius:tema', t) } catch { /* sin storage */ } }, tema)
    await login(page)
    const esperado = tema === 'oscuro' ? 'dark' : 'light'

    for (const ruta of RUTAS) {
      await page.goto(ruta)
      await esperarCarga(page)
      const estado = await page.evaluate(() => ({ attr: document.documentElement.dataset.theme, fondo: getComputedStyle(document.body).backgroundColor }))
      expect(estado.attr, ruta).toBe(esperado)
      expect(estado.fondo, ruta).toBe(CANVAS[tema])
    }

    // Mapa del plano: hoja clara en los dos temas.
    await page.goto('/app/plano')
    await esperarCarga(page)
    const hoja = await page.locator('.plano-hoja').first().evaluate((e) => getComputedStyle(e).backgroundColor)
    expect(hoja).toBe('rgb(255, 255, 255)')

    // Sin flash: el tema ya está puesto antes de que monte React.
    await page.reload({ waitUntil: 'commit' })
    await page.waitForSelector('html[data-theme]', { state: 'attached' })
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(esperado)

    // Impresión: siempre clara.
    await esperarCarga(page)
    await page.emulateMedia({ media: 'print' })
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim())).toBe('248 247 242')
    await page.emulateMedia({ media: 'screen' })

    expect(errores).toEqual([])
  })
}

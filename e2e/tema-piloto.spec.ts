import { test, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Fase 2 del modo oscuro: capturas del piloto (Dashboard, Plano, Caja) en los dos temas.
const OUT = process.env.TEMA_OUT || 'test-results/tema'
const ANCHOS: [string, number, number][] = [['1440', 1440, 900], ['390', 390, 844]]
const RUTAS = [['dashboard', '/app/home'], ['plano', '/app/plano'], ['caja', '/app/caja']]

for (const tema of ['claro', 'oscuro']) {
  for (const [ancho, w, h] of ANCHOS) {
    test(`piloto ${tema} ${ancho}`, async ({ page }) => {
      test.setTimeout(240_000)
      await page.addInitScript((t) => { try { localStorage.setItem('prius:tema', t) } catch { /* */ } }, tema)
      await page.setViewportSize({ width: w, height: h })
      await login(page)
      for (const [nombre, ruta] of RUTAS) {
        await page.goto(ruta)
        await esperarCarga(page)
        await page.waitForTimeout(1200)
        await page.screenshot({ path: `${OUT}/${nombre}-${ancho}-${tema}.png`, fullPage: nombre !== 'plano' })
      }
    })
  }
}

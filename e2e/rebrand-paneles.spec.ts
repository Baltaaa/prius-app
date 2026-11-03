import { test, login } from './fixtures'

// Abre la ficha de un cliente (o varias) y saca captura: valida el panel de
// detalle de Clientes con datos reales. Solo lee (ver e2e/guard.ts).
// ANCHOS=1440x900,1920x1080 · FILA=n elige la fila de la lista.
const ANCHOS = (process.env.ANCHOS || '1440x900').split(',').map((a) => a.split('x').map(Number))
const FILAS = (process.env.FILA || '0').split(',').map(Number)

test('ficha de cliente', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/clientes')
    await page.locator('[data-cliente-id]').first().waitFor({ timeout: 30_000 })
    await page.waitForTimeout(1200)
    for (const fila of FILAS) {
      await page.locator('[data-cliente-id]').nth(fila).click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `design/rebrand-shots/clientes-ficha-${w}-f${fila}.png` })
    }
  }
})

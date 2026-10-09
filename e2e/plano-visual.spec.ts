import { test, expect, login } from './fixtures'

/**
 * Fase 4A (oct 2026) — regresión visual del Plano. Verifica que extraer el
 * dibujo a src/components/plano/ (PlanoGrid/PlanoViewport) no cambió un solo
 * píxel de lo que ve Mado. Compara el contenedor `.plano-area-map` (el mapa
 * en sí — carpas, sombrillas, pasillos, rótulos) en vez de la página entera,
 * para no mezclar ruido de widgets ajenos a esta tarea (clima, ingresos del
 * día) con el dibujo que realmente se tocó.
 *
 * Fechas fijas (no "hoy" relativo) para que la captura no dependa del día en
 * que corre el test: 2026-10-09 (reservas de día reales) y 2027-01-01
 * (período activo real, temporada 2026-2027).
 *
 * No corre en la suite normal (`npm run test:e2e`) — es puntual para esta
 * tarea. Las baselines (`*-snapshots/`) quedan commiteadas como referencia
 * visual futura (ver CLAUDE.md "Plano portable").
 */

const FECHAS = [
  { nombre: 'hoy', valor: '2026-10-09' },
  { nombre: 'con-reservas', valor: '2027-01-01' },
]
const VIEWPORTS = [
  { nombre: '360', width: 360, height: 800 },
  { nombre: '390', width: 390, height: 844 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
]

async function irAlPlano(page, fecha) {
  await page.goto(`/app/plano?fecha=${fecha}`)
  await expect(page.getByText('Cargando plano…')).toHaveCount(0, { timeout: 15_000 })
  await page.waitForTimeout(300) // deja terminar el slide-in de la fecha
}

test.describe('Plano — regresión visual (Fase 4A)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const vp of VIEWPORTS) {
    for (const f of FECHAS) {
      test(`mapa @ ${vp.nombre}px — ${f.nombre}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await irAlPlano(page, f.valor)
        const mapa = page.locator('.plano-area-map')
        await expect(mapa).toBeVisible()
        await expect(mapa).toHaveScreenshot(`mapa-${vp.nombre}-${f.nombre}.png`, {
          mask: [page.locator('.plano-area-map').getByText(/°C|km\/h/)],
        })
      })
    }
  }

  test('fullscreen @ 1440px — hoy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await irAlPlano(page, FECHAS[0].valor)
    await page.getByTitle('Ver en pantalla completa').click()
    const mapa = page.locator('.plano-area-map')
    await expect(mapa).toBeVisible()
    await expect(mapa).toHaveScreenshot('mapa-fullscreen-1440-hoy.png', {
      mask: [page.locator('.plano-area-map').getByText(/°C|km\/h/)],
    })
  })
})

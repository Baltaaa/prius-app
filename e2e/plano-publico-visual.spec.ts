import { test, expect, login } from './fixtures'

/**
 * Regresión visual de /app/dev/plano-publico (Fase 4A, Tarea 5 + hotfix
 * mobile oct 2026) — la variante pública del plano (CeldaPublica: candado/
 * seleccionada/sugerida, sin colores por tipo_alquiler), exactamente lo que
 * va a usar la landing. Solo mobile-360/mobile-390 (no desktop-1440): es la
 * herramienta de desarrollo, el objetivo acá es cubrir el tamaño real en el
 * que la gente reserva desde el celular, no otra vista de escritorio del
 * mismo componente ya cubierto por plano-visual.spec.ts.
 */

test.describe('Plano público (preview) — regresión visual', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('mapa con candados reales', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-1440', 'Solo mobile — ver nota arriba.')

    await page.goto('/app/dev/plano-publico')
    await expect(page.getByText('Cargando disponibilidad…')).toHaveCount(0, { timeout: 15_000 })
    await page.waitForTimeout(400)

    const mapa = page.locator('.plano-area-map, .glass-card-inner').first()
    await expect(mapa).toBeVisible()
    await expect(mapa).toHaveScreenshot('mapa-publico.png')
  })
})

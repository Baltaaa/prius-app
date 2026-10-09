import { test, expect, login } from './fixtures'

/**
 * Regresión visual del Plano (Fase 4A + hotfix mobile, oct 2026). Corre en
 * los tres proyectos de playwright.config.ts (desktop-1440, mobile-360,
 * mobile-390 — channel 'chrome', sin descriptores iPhone). Las capturas
 * commiteadas en *-snapshots/ son la referencia visual: todo cambio que las
 * altere tiene que ser intencional (ver CLAUDE.md "Mobile-first").
 *
 * Compara el contenedor `.plano-area-map` (el mapa en sí) en vez de la
 * página entera, para no mezclar ruido de widgets ajenos al Plano (clima,
 * ingresos del día, badges de notificaciones) con lo que de verdad importa
 * acá — se enmascara además cualquier texto de clima dentro del mapa.
 *
 * Fechas fijas (no "hoy" relativo), para que la captura no dependa del día
 * en que corre el test: 2026-10-09 (reservas de día reales) y 2027-01-01
 * (período activo real, temporada 2026-2027).
 *
 * Script: `pnpm run test:visual` (alias de `playwright test
 * e2e/plano-visual.spec.ts e2e/plano-publico-visual.spec.ts`).
 */

const FECHAS = [
  { nombre: 'hoy', valor: '2026-10-09' },
  { nombre: 'con-reservas', valor: '2027-01-01' },
]

const MASK_CLIMA = (page) => [page.locator('.plano-area-map').getByText(/°C|km\/h/)]

async function irAlPlano(page, fecha) {
  await page.goto(`/app/plano?fecha=${fecha}`)
  await expect(page.getByText('Cargando plano…')).toHaveCount(0, { timeout: 15_000 })
  // No alcanza con que desaparezca "Cargando plano…": bajo latencia real de
  // Supabase se vio ese texto sacarse un instante antes de que las celdas
  // mismas terminaran de pintar (carrera entre el flag `loading` del
  // DataProvider y el primer render de las ~184 <Cell>) — esperar a que
  // haya al menos una celda en el DOM cierra esa carrera de verdad.
  await expect(page.locator('.plano-area-map button').first()).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(400) // deja terminar el slide-in de la fecha + el encuadre inicial
  // Reconfirma justo antes de que el caller mida/capture — bajo latencia
  // real se vio un segundo ciclo de loading arrancar después de pasar el
  // chequeo de arriba pero antes de la captura.
  await expect(page.getByText('Cargando plano…')).toHaveCount(0, { timeout: 15_000 })
}

test.describe('Plano — regresión visual', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const f of FECHAS) {
    test(`mapa — ${f.nombre}`, async ({ page }) => {
      await irAlPlano(page, f.valor)
      const mapa = page.locator('.plano-area-map')
      await expect(mapa).toBeVisible()
      await expect(mapa).toHaveScreenshot(`mapa-${f.nombre}.png`, { mask: MASK_CLIMA(page) })
    })
  }

  test('pantalla completa — hoy', async ({ page }) => {
    await irAlPlano(page, FECHAS[0].valor)
    await page.getByTitle('Ver en pantalla completa').click()
    // El click deja el mouse parado donde estaba el botón "Ver en pantalla
    // completa" — con el reflow a pantalla completa, esa posición puede
    // terminar sobre otra celda y disparar su tooltip de hover (Cell.jsx),
    // dato real pero no parte de lo que este test compara. Se saca el mouse
    // del medio antes de medir, así la captura es siempre determinística.
    await page.mouse.move(0, 0)
    const mapa = page.locator('.plano-area-map')
    await expect(mapa).toBeVisible()
    await page.waitForTimeout(300) // anim de entrada del modal (zoom-in-95 / fade-in)
    await expect(mapa).toHaveScreenshot('mapa-fullscreen.png', { mask: MASK_CLIMA(page) })
  })
})

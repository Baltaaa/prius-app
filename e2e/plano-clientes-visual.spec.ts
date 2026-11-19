import { test, expect, login } from './fixtures'

/**
 * Paridad visual del modal "vista clientes" del Plano (Fase 6A, nov 2026).
 * El modal pasó a usar MarcoPlanoClaro / PlanoClaro / CeldaClara
 * (src/components/plano, portables para beachFlow) y el CRM no puede cambiar
 * ni un píxel: las capturas *-snapshots/ se sacaron con el código ANTERIOR al
 * corte y este spec compara contra ellas. Corre en desktop-1440, mobile-360 y
 * mobile-390 (channel 'chrome'). Solo lectura.
 *
 * Fecha fija por deep link (?fecha=): 2027-01-15, con la carpa 74 de Ana
 * Lescano ocupada por temporada y reservas de período reales. Se compara la
 * hoja del modal (no la página: el fondo del CRM detrás del overlay trae
 * badges y datos ajenos), en los dos temas y en cada estado del marco.
 */

const FECHA = '2027-01-15'
const TEMAS = ['claro', 'oscuro'] as const

async function abrirPlano(page, tema: (typeof TEMAS)[number]) {
  await page.addInitScript((t) => { try { localStorage.setItem('prius:tema', t) } catch { /* sin storage */ } }, tema)
  await login(page)
  await page.goto(`/app/plano?fecha=${FECHA}`)
  await expect(page.getByText('Cargando plano…')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('[data-plano-rotable] button').first()).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
  await expect(page.getByText('Cargando plano…')).toHaveCount(0)
}

async function abrirVistaClientes(page) {
  await page.getByTitle('Ver en pantalla completa').first().click()
  await page.mouse.move(0, 0)
  const hoja = page.locator('.plano-fullscreen-sheet')
  await expect(hoja).toBeVisible()
  await page.waitForTimeout(500)
  return hoja
}

for (const tema of TEMAS) {
  test(`vista clientes — ${tema}`, async ({ page }) => {
    test.setTimeout(240_000)
    await abrirPlano(page, tema)

    // Vista normal (fuera del modal): el mapa del CRM no cambia.
    const mapa = page.locator('[data-plano-rotable]').first()
    await expect(mapa).toHaveScreenshot(`normal-${tema}.png`)
    // La card completa del mapa: incluye la barra / pill de zoom (también portable desde la 6A).
    const seccion = page.locator('section:has([data-plano-rotable])').first()
    await expect(seccion).toHaveScreenshot(`normal-seccion-${tema}.png`)

    const hoja = await abrirVistaClientes(page)
    await expect(hoja).toHaveScreenshot(`clientes-${tema}-todo.png`)

    await hoja.getByRole('button', { name: /Carpas/ }).click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    await expect(hoja).toHaveScreenshot(`clientes-${tema}-carpas.png`)

    await hoja.getByRole('button', { name: /Sombrillas/ }).click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    await expect(hoja).toHaveScreenshot(`clientes-${tema}-sombrillas.png`)

    await hoja.getByRole('button', { name: /^Todo$/ }).click()
    await hoja.getByRole('button', { name: 'Rotar el plano 180°' }).click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(900)
    await expect(hoja).toHaveScreenshot(`clientes-${tema}-rotado.png`)
  })
}

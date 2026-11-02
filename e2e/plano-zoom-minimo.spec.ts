import { test, expect, login } from './fixtures'

// Con Manrope en el mapa: ningún número de celda se sale de su caja a la
// escala mínima del plano (fitScale * 0.5, Dashboard.jsx). El zoom es un
// transform, así que texto y caja escalan igual y la comparación es exacta.
test.describe('Plano — números a zoom mínimo', () => {
  test('ningún número de celda se corta', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'), 'el plano mobile se valida aparte')
    await login(page)
    await page.goto('/app/plano?fecha=2027-01-01')
    await expect(page.locator('.plano-area-map button').first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(400)

    const alejar = page.getByTitle('Alejar').first()
    for (let i = 0; i < 12; i++) await alejar.click()
    await page.waitForTimeout(400)

    const resultado = await page.locator('.plano-area-map').evaluate((mapa) => {
      const numeros = [...mapa.querySelectorAll('span')].filter((s) => /^\d{1,3}$/.test(s.textContent || ''))
      const cortados = numeros.flatMap((s) => {
        const rango = document.createRange()
        rango.selectNodeContents(s)
        const texto = rango.getBoundingClientRect()
        const caja = s.getBoundingClientRect()
        return texto.left < caja.left - 0.5 || texto.right > caja.right + 0.5 ? [s.textContent] : []
      })
      return { total: numeros.length, cortados }
    })

    expect(resultado.total).toBeGreaterThan(100)
    expect(resultado.cortados).toEqual([])
    await page.locator('.plano-area-map').screenshot({ path: `design/rebrand-shots/plano-zoom-minimo-${testInfo.project.name}.png` })
  })
})

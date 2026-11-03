import { test, login } from './fixtures'

// Capturas de verificación del rebranding. RUTAS=home,caja elige pantallas,
// ANCHOS=390x844,1440x900 elige tamaños. Solo lee (ver e2e/guard.ts).
const ANCHOS = (process.env.ANCHOS || '390x844,768x1024,1440x900').split(',').map((a) => a.split('x').map(Number))
const RUTAS = (process.env.RUTAS || 'home').split(',')

test('capturas', async ({ page }) => {
  test.setTimeout(240_000)
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))
  await login(page)
  for (const ruta of RUTAS) {
    for (const [w, h] of ANCHOS) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`/app/${ruta.replaceAll('~', '?')}`)
      await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 })
      await page.waitForTimeout(1200)
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 20_000 }).catch(() => {})
      await page.waitForTimeout(1300)
      const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      const nombre = ruta.replace(/[^a-z0-9-]/gi, '_')
      await page.screenshot({ path: `design/rebrand-shots/${nombre}-${w}.png` })
      if (desborda) console.log('DESBORDA', ruta, w)
    }
  }
  if (errores.length) console.log('ERRORES', [...new Set(errores)].slice(0, 5))
})

import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Zona sticky superior flotante (ProgressiveBlurHeader): topbar + toolbar de la
// sección en una sola pieza, con el contenido pasando por debajo. Solo lectura.
const TODOS = '390x844,768x1024,1280x800,1440x900'
const ANCHOS = (process.env.ANCHOS || TODOS).split(',').map((a) => a.split('x').map(Number) as [number, number])
const RUTAS = ['home', 'historial', 'reportes', 'leads', 'clientes', 'reservas', 'caja', 'comprobantes', 'plano']

test('zona sticky: alto medido, contenido debajo y capas de blur', async ({ page }) => {
  test.setTimeout(600_000)
  await login(page)
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    for (const ruta of RUTAS) {
      await page.goto(`/app/${ruta}`)
      await esperarCarga(page)
      const info = await page.evaluate(() => {
        const zona = document.querySelector('.pbh') as HTMLElement
        const main = document.getElementById('app-main-scroll') as HTMLElement
        const capas = [...document.querySelectorAll('.pbh-capa')].filter((c) => getComputedStyle(c).display !== 'none').length
        const topbar = zona.querySelector('header') as HTMLElement
        return {
          zonaH: Math.round(zona.getBoundingClientRect().height),
          padTop: Math.round(parseFloat(getComputedStyle(main).paddingTop)),
          topbarH: Math.round(topbar.getBoundingClientRect().height),
          capas,
          fondo: getComputedStyle(zona.querySelector('.pbh-fondo')!).backgroundImage.includes('gradient'),
          hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })
      const donde = `${ruta} ${w}x${h}`
      // el padding de la página = alto de la zona + 4px de aire
      expect(Math.abs(info.padTop - (info.zonaH + 4)), `${donde} padding vs zona ${JSON.stringify(info)}`).toBeLessThanOrEqual(1)
      expect(info.fondo, `${donde} fondo en degradé`).toBe(true)
      expect(info.capas, `${donde} capas de blur`).toBe(w < 768 ? 3 : 4)
      expect(info.hscroll, `${donde} scroll horizontal`).toBe(false)
      if (w < 768) expect(info.topbarH, `${donde} alto de la topbar mobile`).toBeGreaterThanOrEqual(52)
    }
  }
})

test('zona sticky: Home compacta el saludo al scrollear', async ({ page }) => {
  await login(page)
  for (const [w, h] of [[390, 844], [1440, 900]] as [number, number][]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/home')
    await esperarCarga(page)
    const h1 = page.locator('header h1')
    const antes = await h1.evaluate((e) => ({ t: getComputedStyle(e).transform, h: document.querySelector('header')!.getBoundingClientRect().height }))
    await page.evaluate(() => { document.getElementById('app-main-scroll')!.scrollTop = 400 })
    await page.waitForTimeout(600)
    const despues = await h1.evaluate((e) => ({
      m: new DOMMatrix(getComputedStyle(e).transform).a,
      sub: parseFloat(getComputedStyle(document.querySelector('.greeting-sub')!).opacity),
      h: document.querySelector('header')!.getBoundingClientRect().height,
    }))
    expect(despues.m, `${w}: el saludo se achica`).toBeLessThan(0.9)
    expect(despues.sub, `${w}: la bajada se desvanece`).toBe(0)
    expect(Math.abs(despues.h - antes.h), `${w}: el alto de la topbar no cambia`).toBeLessThanOrEqual(1)
    await page.evaluate(() => { document.getElementById('app-main-scroll')!.scrollTop = 0 })
    await page.waitForTimeout(600)
    const vuelve = await h1.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)
    expect(vuelve, `${w}: vuelve a su tamaño`).toBeGreaterThan(0.99)
  }
})

test('zona sticky: el contenido scrollea por debajo (Historial)', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/historial')
  await esperarCarga(page)
  const zonaBottom = await page.evaluate(() => document.querySelector('.pbh')!.getBoundingClientRect().bottom)
  await page.evaluate(() => { document.getElementById('app-main-scroll')!.scrollTop = 500 })
  await page.waitForTimeout(400)
  // hay contenido de la lista detrás de la zona (su borde superior quedó arriba del borde de la zona)
  const detras = await page.evaluate((zb) => {
    const filas = [...document.querySelectorAll('#app-main-scroll [class*="border-b"], #app-main-scroll button')]
    return filas.some((f) => { const r = f.getBoundingClientRect(); return r.top < zb - 8 && r.bottom > 20 })
  }, zonaBottom)
  expect(detras).toBe(true)
  // y la zona sigue pegada arriba
  expect(await page.evaluate(() => Math.round(document.querySelector('.pbh')!.getBoundingClientRect().top))).toBe(0)
})

import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Toolbars sticky de desktop: 2 filas como máximo, alto <= 128px (112 + 16 de pt-4), controles de
// 40px, cero filas extra por wrap y topbar de 64px con título de 24px. Solo lectura.
const TODOS = '1024x768,1280x800,1366x768,1440x900,1920x1080'
const ANCHOS = (process.env.ANCHOS || TODOS).split(',').map((a) => a.split('x').map(Number) as [number, number])
const RUTAS = ['historial', 'reservas', 'clientes', 'caja', 'reportes', 'leads', 'comprobantes']

test('toolbars desktop: alto, filas y controles de 40px', async ({ page }) => {
  test.setTimeout(900_000)
  await login(page)
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    for (const ruta of RUTAS) {
      await page.goto(`/app/${ruta}`)
      await esperarCarga(page)
      await page.waitForTimeout(300)
      const info = await page.evaluate(() => {
        const zona = document.querySelector('.pbh') as HTMLElement
        const topbar = zona.querySelector('header') as HTMLElement
        const slot = topbar.nextElementSibling as HTMLElement
        const toolbarH = Math.round(slot.getBoundingClientRect().height)
        // filas = cantidad de "tops" distintos entre los controles visibles de la toolbar
        const controles = [...slot.querySelectorAll('button, input, [role="group"] > button')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' })
        const ancla = (e: Element) => (e.closest('[role="group"]') || e) as HTMLElement
        const tops = [...new Set(controles.map((e) => Math.round(ancla(e).getBoundingClientRect().top / 8)))]
        const altos = controles
          .filter((e) => !e.closest('[role="group"]') && !(e as HTMLElement).className.toString().includes('absolute'))
          .map((e) => Math.round(e.getBoundingClientRect().height))
        const h1 = topbar.querySelector('h1') as HTMLElement
        return {
          topbarH: Math.round(topbar.getBoundingClientRect().height),
          titulo: getComputedStyle(h1).fontSize,
          toolbarH, filas: tops.length, altos,
          zonaBottom: Math.round(zona.getBoundingClientRect().bottom),
          hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })
      const donde = `${ruta} ${w}x${h}`
      expect(info.topbarH, `${donde} alto de la topbar`).toBe(64)
      if (ruta !== 'home') expect(info.titulo, `${donde} título`).toBe('24px')
      expect(info.toolbarH, `${donde} alto de la toolbar ${JSON.stringify(info)}`).toBeLessThanOrEqual(128)
      expect(info.filas, `${donde} filas`).toBeLessThanOrEqual(2)
      for (const a of info.altos) expect(a, `${donde} alto de control ${JSON.stringify(info.altos)}`).toBeLessThanOrEqual(44)
      expect(info.hscroll, `${donde} scroll horizontal`).toBe(false)
    }
  }
})

test('historial: toolbar en 2 filas, chip de rango, tabs en una línea y buscador colapsado', async ({ page }) => {
  await login(page)
  for (const [w, h, colapsado] of [[1024, 768, true], [1280, 800, false], [1440, 900, false]] as [number, number, boolean][]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/historial')
    await esperarCarga(page)
    // buscador: ícono a 1024, campo desde 1280
    const campo = page.getByPlaceholder('Buscar por usuario, cliente o comprobante')
    if (colapsado) {
      await expect(campo).toHaveCount(0)
      await page.getByRole('button', { name: 'Buscar' }).click()
      await expect(campo).toBeVisible()
      await page.mouse.click(w - 40, h - 40)
      await expect(campo).toHaveCount(0)
    } else {
      await expect(campo).toBeVisible()
      const b = (await campo.boundingBox())!
      expect(b.width).toBeLessThanOrEqual(360 + 1)
    }
    // UN chip de rango que abre un popover con los dos selectores
    const chip = page.getByRole('button', { name: /^Rango de fechas/ })
    await expect(chip).toBeVisible()
    await expect(chip).toHaveText(/\d{2}\/\d{2} – \d{2}\/\d{2}/)
    await chip.click()
    await expect(page.getByLabel('Desde')).toBeVisible()
    await expect(page.getByLabel('Hasta')).toBeVisible()
    await page.keyboard.press('Escape')
    // tabs de tipo: una sola línea (mismo top en todas)
    const tops = await page.getByRole('group', { name: 'Tipo de movimiento' }).getByRole('button').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))])
    expect(tops.length, `${w}: tabs en una línea`).toBe(1)
    // "Personalizado" se activa al editar el rango? el segmented refleja el rango actual
    await expect(page.getByRole('group', { name: 'Rango' }).getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true')
  }
})

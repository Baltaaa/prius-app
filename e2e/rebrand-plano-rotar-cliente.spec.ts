import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Plano: "Rotar" (180°, 600ms, rótulos contra-rotados, geometría y gestos intactos) y modo
// cliente en pantalla completa. Solo lectura (no abre formularios ni guarda nada).
const ANCHOS: [string, number, number][] = [['desktop', 1440, 900], ['mobile', 390, 844]]

const matriz = (page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector(s) as HTMLElement
  const m = new DOMMatrix(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform)
  return { a: m.a, b: m.b, angulo: Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI) }
}, sel)

for (const [nombre, w, h] of ANCHOS) {
  test(`plano ${nombre}: Rotar gira 180° en 600ms y los números siguen derechos`, async ({ page }) => {
    test.setTimeout(240_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/plano')
    await esperarCarga(page)
    const rotar = page.getByRole('button', { name: 'Rotar el plano 180°' })
    await expect(rotar).toBeVisible()
    const caja = () => page.evaluate(() => { const r = document.querySelector('[data-plano-rotable]')!.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
    const antes = await caja()
    // un número de unidad: contra-rotado
    const numero = '[data-plano-rotable] .plano-contra'
    expect((await matriz(page, '[data-plano-rotable]')).angulo).toBe(0)

    await rotar.click()
    // a mitad de la animación el giro está en curso (ni 0 ni 180): se muestrea el ángulo cada 60ms
    const muestras: number[] = []
    for (let i = 0; i < 14; i++) { muestras.push(Math.abs((await matriz(page, '[data-plano-rotable]')).angulo)); await page.waitForTimeout(60) }
    console.log(`${nombre}: ángulos durante el giro = ${muestras.join(',')}`)
    const medio = muestras.find((a) => a > 5 && a < 175) ?? 0
    expect(Math.abs(medio), `giro en curso (${medio}°)`).toBeGreaterThan(5)
    expect(Math.abs(medio)).toBeLessThan(175)
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-plano-rotable]')!).transitionDuration)).toBe('0.6s')
    await page.waitForTimeout(600)
    expect(Math.abs((await matriz(page, '[data-plano-rotable]')).angulo)).toBe(180)
    // los rótulos contra-giran: orientación neta = 0° para TODOS (números de celdas, T/P/D, zonas)
    const netos = await page.evaluate(() => [...document.querySelectorAll('[data-plano-rotable] .plano-contra')].map((e) => {
      let m = new DOMMatrix()
      for (let n: Element | null = e; n && n !== document.body; n = n.parentElement) {
        const t = getComputedStyle(n).transform
        if (t !== 'none') m = new DOMMatrix(t).multiply(m)
      }
      return Math.abs(Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI))
    }))
    expect(netos.length, 'hay rótulos contra-rotados').toBeGreaterThan(150)
    expect(new Set(netos), 'todos derechos').toEqual(new Set([0]))
    // la geometría no cambia: misma caja
    expect(await caja()).toEqual(antes)

    // zoom y taps siguen funcionando rotado
    const escala = () => page.evaluate(() => { const r = document.querySelector('[data-plano-rotable]')!.getBoundingClientRect(); return Math.round(r.width) })
    const w0 = await escala()
    await page.locator('button[title="Acercar"]:visible').first().click()
    await page.waitForTimeout(500)
    expect(await escala(), 'el zoom agranda el plano rotado').toBeGreaterThan(w0)
    await page.locator('button[title="Encuadrar"]:visible').first().click()
    await page.waitForTimeout(500)
    const ocupada = page.locator('[data-plano-rotable] button[data-deeplink-id]:has(.plano-contra:text-matches("^[TPD]$"))').first().locator('xpath=..')
    if (await ocupada.count()) {
      await ocupada.click()
      await page.waitForTimeout(700)
      // desktop: panel lateral con la ficha; mobile/tablet: hoja de detalle
      await expect(page.getByText(/Tocá una unidad para ver el detalle/)).toHaveCount(0)
      await page.keyboard.press('Escape')
    }

    // volver a 0°
    await rotar.click()
    await page.waitForTimeout(900)
    expect((await matriz(page, '[data-plano-rotable]')).angulo).toBe(0)
    expect(await caja()).toEqual(antes)
  })

  test(`plano ${nombre}: pantalla completa = modo cliente`, async ({ page }) => {
    test.setTimeout(240_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/plano')
    await esperarCarga(page)

    // fuera de pantalla completa SÍ están los tiles, Referencias e Imprimir
    await expect(page.getByRole('radiogroup', { name: 'Filtrar el plano por estado' })).toBeVisible()
    await expect(page.locator('button[title="Referencias"]:visible').first()).toBeVisible()
    await expect(page.locator('button[title="Imprimir A4"]:visible').first()).toBeVisible()
    // dejar un filtro de estado puesto: en modo cliente no debe aplicarse
    await page.getByRole('radio', { name: /Pendientes/ }).first().click()

    await page.getByTitle('Ver en pantalla completa').first().click()
    await page.waitForTimeout(800)

    // ocultos
    await expect(page.getByRole('radiogroup', { name: 'Filtrar el plano por estado' })).toHaveCount(0)
    for (const t of ['Todas', 'Ocupadas', 'Libres', /Pendientes/]) await expect(page.getByRole('radio', { name: t })).toHaveCount(0)
    await expect(page.locator('button[title="Referencias"]:visible')).toHaveCount(0)
    await expect(page.locator('button[title="Imprimir A4"]:visible')).toHaveCount(0)
    await expect(page.getByText(/Tocá una unidad para ver el detalle/)).toHaveCount(0)
    // visibles: fecha, Todo/Carpas/Sombrillas, zoom, rotar, salir
    await expect(page.getByRole('radiogroup', { name: 'Filtrar el plano por tipo de unidad' }).or(page.getByRole('group', { name: 'Filtrar el plano por tipo de unidad' })).first()).toBeVisible()
    await expect(page.getByTitle('Acercar').first()).toBeVisible()
    await expect(page.getByTitle('Alejar').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rotar el plano 180°' })).toBeVisible()
    await expect(page.getByTitle('Cerrar pantalla completa').first()).toBeVisible()
    await expect(page.locator('input[readonly]').first()).toBeVisible() // fecha

    // todas las celdas ocupadas del mismo color, sin letras ni marcas, y el filtro de estado no atenúa nada
    const celdas = await page.evaluate(() => [...document.querySelectorAll('[data-plano-rotable] button[data-deeplink-id]')].map((b) => {
      const cs = getComputedStyle(b as HTMLElement)
      const raiz = b.closest('[class*="cursor-pointer"]') as HTMLElement | null
      return {
        bg: cs.backgroundColor,
        letra: /^[TPD]$/.test(((b.querySelector('.plano-contra') as HTMLElement)?.textContent || '').trim()),
        punto: !!b.querySelector('.bg-green-400'),
        punteado: cs.borderStyle.includes('dashed'),
        opacidad: Number(cs.opacity),
        padreOpacidad: raiz ? Number(getComputedStyle(raiz).opacity) : 1,
        reloj: !!b.querySelector('svg'),
      }
    }))
    expect(celdas.length).toBeGreaterThan(150)
    const colores = new Set(celdas.map((c) => c.bg))
    expect([...colores].length, `colores distintos: ${[...colores].join(' | ')}`).toBeLessThanOrEqual(2)
    expect(celdas.some((c) => c.letra), 'sin letras T/P/D').toBe(false)
    expect(celdas.some((c) => c.punto), 'sin punto de pagada').toBe(false)
    expect(celdas.some((c) => c.punteado), 'sin borde punteado').toBe(false)
    expect(celdas.some((c) => c.reloj), 'sin íconos de reloj').toBe(false)
    expect(celdas.every((c) => c.opacidad === 1), 'el filtro de estado no atenúa en modo cliente').toBe(true)

    // tocar una unidad ocupada no abre ficha: ni titular ni saldo
    const oscura = await page.evaluateHandle(() => [...document.querySelectorAll('[data-plano-rotable] button[data-deeplink-id]')].find((b) => getComputedStyle(b as HTMLElement).backgroundColor !== 'rgb(255, 255, 255)')!.parentElement)
    const el = oscura.asElement()!
    await el.scrollIntoViewIfNeeded()
    await el.hover().catch(() => {})
    await page.waitForTimeout(300)
    await expect(page.getByText(/PAGADO|PAGO PENDIENTE/)).toHaveCount(0) // tooltip del titular
    await el.click().catch(() => {})
    await page.waitForTimeout(800)
    await expect(page.getByText(/Ver ficha de cliente|Titular|Registrar pago|Asignar/).first()).toHaveCount(0)
    expect(await page.locator('[role="dialog"]').count()).toBe(0)
    // sigue en pantalla completa
    await expect(page.getByTitle('Cerrar pantalla completa').first()).toBeVisible()

    // rotar funciona dentro del modo cliente
    await page.getByRole('button', { name: 'Rotar el plano 180°' }).click()
    await page.waitForTimeout(900)
    expect(Math.abs((await matriz(page, '[data-plano-rotable]')).angulo)).toBe(180)

    // salir: vuelven los controles completos y el modo normal
    await page.getByTitle('Cerrar pantalla completa').first().click()
    await page.waitForTimeout(600)
    await expect(page.getByRole('radiogroup', { name: 'Filtrar el plano por estado' })).toBeVisible()
    await expect(page.locator('button[title="Referencias"]:visible').first()).toBeVisible()
  })
}

import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Modo privacidad global: con el modo activo ningún texto visible puede mostrar "$" seguido de un
// dígito ("US$ 12" incluido), salvo en inputs (carga de montos) e impresión. Se recorren todas las
// pantallas y los paneles que muestran montos (fichas, panel del Plano, búsqueda, notificaciones,
// preview de comprobante). Solo lectura.
const MONTO = /(?:US)?\$\s?\d/

async function hallazgos(page): Promise<string[]> {
  return page.evaluate((reSrc) => {
    const re = new RegExp(reSrc)
    const out: string[] = []
    const texto = document.body.innerText || ''
    for (const linea of texto.split('\n')) if (re.test(linea)) out.push(`texto: ${linea.trim().slice(0, 100)}`)
    // SVG (gráficos) y atributos que se leen o se anuncian
    for (const t of document.querySelectorAll('svg text, svg title, svg tspan')) if (re.test(t.textContent || '')) out.push(`svg: ${(t.textContent || '').slice(0, 80)}`)
    for (const el of document.querySelectorAll('[title],[aria-label],[alt],[data-tooltip]')) {
      for (const a of ['title', 'aria-label', 'alt', 'data-tooltip']) {
        const v = el.getAttribute(a)
        if (v && re.test(v)) out.push(`@${a}: ${v.slice(0, 80)}`)
      }
    }
    return [...new Set(out)]
  }, MONTO.source)
}

const PANTALLAS = [
  '/app/home', '/app/plano', '/app/recepcion', '/app/reservas', '/app/clientes', '/app/caja', '/app/caja?fecha=2026-11-05', '/app/caja?fecha=2026-10-31',
  '/app/reportes', '/app/historial?hDesde=2026-08-01', '/app/leads', '/app/comprobantes',
  '/app/notificaciones', '/app/perfil', '/app/ocupacion',
]

for (const [nombre, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]] as [string, number, number][]) {
  test(`privacidad ${nombre}: con el modo activo no queda ningún monto a la vista`, async ({ page }) => {
    test.setTimeout(600_000)
    // El modo queda guardado por usuario: se fuerza activo para todo el recorrido.
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem
      Storage.prototype.getItem = function (k: string) { return k.startsWith('prius:montos-ocultos:') ? '1' : get.call(this, k) }
    })
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    const fallas: string[] = []
    const cobertura: string[] = []
    const revisar = async (donde: string) => {
      await page.waitForTimeout(500)
      const tapados = await page.evaluate(() => ((document.body.innerText || '').match(/\$\s•{6}/g) || []).length)
      cobertura.push(`${donde}: ${tapados} montos tapados`)
      for (const f of await hallazgos(page)) fallas.push(`[${nombre}] ${donde} -> ${f}`)
    }

    for (const ruta of PANTALLAS) {
      await page.goto(ruta)
      await esperarCarga(page)
      await revisar(ruta)

      if (ruta === '/app/clientes' || ruta === '/app/reservas') {
        const fila = ruta === '/app/clientes' ? page.locator('li[data-cliente-id]').first() : page.locator('#app-main-scroll tbody tr, #app-main-scroll div.cursor-pointer').first()
        if (await fila.count()) { await fila.click().catch(() => {}); await esperarCarga(page); await revisar(`${ruta} (ficha)`) }
      }
      if (ruta === '/app/reportes') {
        for (const tab of ['Semanal', 'Mensual', 'Anual', 'Diario']) {
          const b = page.getByRole('button', { name: tab, exact: true }).first()
          if (await b.count()) { await b.click().catch(() => {}); await esperarCarga(page); await revisar(`${ruta} (${tab})`) }
        }
        const usd = page.getByRole('button', { name: 'USD', exact: true }).first()
        if (await usd.count()) { await usd.click().catch(() => {}); await esperarCarga(page); await revisar(`${ruta} (USD)`) }
      }
      if (ruta.startsWith('/app/caja?')) {
        for (const tab of ['Movimientos', 'Arqueo', 'Resumen', 'Historial']) {
          const b = page.getByRole('tab', { name: new RegExp(tab, 'i') }).or(page.getByRole('button', { name: new RegExp(`^${tab}`, 'i') })).first()
          if (await b.count()) { await b.click().catch(() => {}); await esperarCarga(page); await revisar(`${ruta} (${tab})`) }
        }
      }
      if (ruta === '/app/historial?hDesde=2026-08-01') {
        const fila = page.locator('#app-main-scroll button.hover-row').first()
        if (await fila.count()) { await fila.click(); await revisar(`${ruta} (detalle de evento)`) }
      }
    }

    // Plano: panel de una unidad ocupada
    await page.goto('/app/plano')
    await esperarCarga(page)
    const ocupada = page.locator('button[data-deeplink-id]:has-text("T")').first().locator('xpath=..')
    if (await ocupada.count()) { await ocupada.click().catch(() => {}); await esperarCarga(page); await revisar('plano (panel de unidad)') }

    // Búsqueda global y notificaciones
    await page.goto('/app/home')
    await esperarCarga(page)
    const bell = page.getByRole('button', { name: /notificaciones/i }).first()
    if (await bell.count()) { await bell.click().catch(() => {}); await page.waitForTimeout(600); await revisar('notificaciones (popover)') }
    await page.keyboard.press('Escape')
    if (w >= 1280) {
      const buscador = page.getByPlaceholder('Búsqueda inteligente').first()
      await buscador.fill('ma')
      await page.waitForTimeout(900)
      await revisar('búsqueda global (resultados)')
    }

    console.log(cobertura.join('\n'))
    const porPantalla = new Map<string, string[]>()
    for (const f of fallas) { const k = f.split(' -> ')[0]; porPantalla.set(k, [...(porPantalla.get(k) || []), f]) }
    const resumen = [...porPantalla.entries()].map(([k, v]) => `${k}: ${v.length} hallazgos\n   ${v.slice(0, 5).map((x) => x.split(' -> ')[1]).join('\n   ')}`)
    expect(fallas.length, resumen.join('\n')).toBe(0)
  })
}

for (const [nombre, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]] as [string, number, number][]) {
  test(`privacidad ${nombre}: el ojito alterna en vivo, los dos controles comparten estado y la pill lo revierte`, async ({ page }) => {
    test.setTimeout(300_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/home')
    await esperarCarga(page)

    // Arranca con montos visibles (sin preferencia guardada para esta sesión de prueba)
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('prius:montos-ocultos:')).forEach((k) => localStorage.removeItem(k)))
    await page.reload()
    await esperarCarga(page)
    expect((await hallazgos(page)).length, 'hay montos visibles al inicio').toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: /Montos ocultos/ })).toHaveCount(0)

    // Ojito del hero (KPI de cobranzas de la temporada)
    const ojitos = page.getByRole('button', { name: 'Ocultar montos' })
    expect(await ojitos.count(), 'ojito del hero (+ el de la card de Caja si hay caja)').toBeGreaterThanOrEqual(1)
    await ojitos.first().click()
    await page.waitForTimeout(400)
    expect(await hallazgos(page), 'Home oculta').toEqual([])
    // Los dos ojitos controlan el mismo estado: todos pasan a "Mostrar montos"
    await expect(page.getByRole('button', { name: 'Ocultar montos' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Montos ocultos/ })).toBeVisible()

    // Navegación dentro de la app (sin recargar): sigue oculto en las pantallas con montos
    for (const ruta of ['/app/reportes', '/app/caja?fecha=2026-11-05', '/app/reservas']) {
      await page.evaluate((r) => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate')) }, ruta)
      await esperarCarga(page)
      expect(await hallazgos(page), `${ruta} oculta tras navegar`).toEqual([])
    }

    // El estado persiste por usuario en localStorage
    const guardado = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('prius:montos-ocultos:')).map(([, v]) => v))
    expect(guardado).toEqual(['1'])
    await page.reload()
    await esperarCarga(page)
    expect(await hallazgos(page), 'tras recargar sigue oculto').toEqual([])

    // Reportes: alternar EN VIVO sobre la pantalla abierta (sin remontar)
    await page.goto('/app/reportes')
    await esperarCarga(page)
    await page.getByRole('button', { name: /Montos ocultos/ }).click()
    await page.waitForTimeout(500)
    expect((await hallazgos(page)).length, 'al tocar la pill se muestran de nuevo').toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: /Montos ocultos/ })).toHaveCount(0)
    expect(await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('prius:montos-ocultos:')).map(([, v]) => v))).toEqual(['0'])

    // Ojito de la card de Caja (misma preferencia): ocultar y volver a mostrar para dejar limpio
    await page.goto('/app/home')
    await esperarCarga(page)
    await page.getByRole('button', { name: 'Ocultar montos' }).last().click()
    await expect(page.getByRole('button', { name: /Montos ocultos/ })).toBeVisible()
    await page.getByRole('button', { name: /Montos ocultos/ }).click()
    await expect(page.getByRole('button', { name: /Montos ocultos/ })).toHaveCount(0)
  })
}

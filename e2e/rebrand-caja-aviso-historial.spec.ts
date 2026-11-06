import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Aviso de cierre automático de caja: sale de la card del sidebar y vive en las notificaciones
// (derivado de arqueo_pendiente). Historial: sin "Personalizado" y select de usuarios completo.
// Solo lectura.
const ANCHOS: [string, number, number][] = [['desktop', 1440, 900], ['mobile', 390, 844]]
const AVISO = /se cerró automáticamente/

for (const [nombre, w, h] of ANCHOS) {
  test(`caja ${nombre}: la card queda limpia y el aviso es una notificación de alerta`, async ({ page }) => {
    test.setTimeout(240_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/home')
    await esperarCarga(page)
    await page.waitForTimeout(1500)

    // la card de Caja diaria no lleva el aviso amarillo (en ninguna pantalla que la monta)
    const card = page.locator('section:visible:has-text("Caja diaria")').first()
    await expect(card).toBeVisible()
    await expect(card.getByText(AVISO)).toHaveCount(0)
    await expect(card.getByText(/Hacer arqueo/)).toHaveCount(0)

    // campana con su badge (punto de pendientes)
    const campana = page.getByRole('button', { name: 'Notificaciones' }).first()
    await expect(campana).toBeVisible()
    await expect(campana.locator('span.bg-ink')).toHaveCount(1)

    // la notificación en la página de Notificaciones (mismo contenido que la campana)
    await page.goto('/app/notificaciones')
    await esperarCarga(page)
    await page.getByRole('button', { name: /^Pendientes/ }).click()
    const item = page.locator('[data-notif-tipo="arqueo_pendiente"]')
    await expect(item, 'UNA sola notificación agrupada').toHaveCount(1)
    const texto = (await item.innerText()).replace(/\s+/g, ' ')
    console.log(`${nombre}: ${texto}`)
    expect(texto).toMatch(/\d+ cajas cerradas automáticamente: falta arqueo y Z|La caja del \d{2}\/\d{2} se cerró automáticamente a las 00:00\. Falta hacer el arqueo y la Z\./)
    // la lista de fechas va completa (sin truncar) cuando son varias
    if (/cajas cerradas/.test(texto)) expect(texto).toMatch(/\d{2}\/\d{2}(, \d{2}\/\d{2})+/)
    // tono de alerta: fondo danger-soft
    expect(await item.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(253, 236, 236)')

    // desktop: también en el panel de la campana
    if (nombre === 'desktop') {
      await page.goto('/app/home')
      await esperarCarga(page)
      await page.getByRole('button', { name: 'Notificaciones' }).first().hover()
      await expect(page.locator('[data-popover-anclado] [data-notif-tipo="arqueo_pendiente"]')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await page.goto('/app/notificaciones')
      await esperarCarga(page)
      await page.getByRole('button', { name: /^Pendientes/ }).click()
    }

    // click: abre Caja (varias -> en la caja más vieja con la lista; una -> arqueo listo)
    await page.locator('[data-notif-tipo="arqueo_pendiente"]').click()
    await page.waitForTimeout(1200)
    const url = new URL(page.url())
    expect(url.pathname).toBe('/app/caja')
    expect(url.searchParams.get('fecha')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await expect(page.getByText('Cerrada automáticamente · falta el arqueo').locator('visible=true').first()).toBeVisible()
  })
}

test('historial: sin "Personalizado" y "Todos los usuarios" siempre completo', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page)
  for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900], [390, 844]] as [number, number][]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/historial')
    await esperarCarga(page)
    if (w < 768) await page.getByRole('button', { name: 'Mostrar filtros' }).click()
    const seg = page.getByRole('group', { name: 'Rango' })
    await expect(seg.getByRole('button')).toHaveText(['Hoy', '7 días', 'Mes'])
    await expect(page.getByText('Personalizado')).toHaveCount(0)
    await expect(seg.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true')

    // el select: texto completo, sin ellipsis, y no se achica
    const sel = page.locator('button[aria-haspopup="listbox"]:has-text("Todos los usuarios"), button:has(span:text-is("Todos los usuarios"))').first()
    const info = await sel.evaluate((b) => {
      const sp = [...b.querySelectorAll('span')].find((e) => e.textContent?.trim() === 'Todos los usuarios') as HTMLElement
      const r = b.getBoundingClientRect()
      return { truncado: sp.scrollWidth > sp.clientWidth + 1, ancho: Math.round(r.width), txt: Math.round(sp.getBoundingClientRect().width), right: r.right }
    })
    console.log(`historial ${w}: select ${JSON.stringify(info)}`)
    expect(info.truncado, `${w}: "Todos los usuarios" truncado`).toBe(false)
    expect(info.right).toBeLessThanOrEqual(w)
    if (w >= 768) {
      // la fila 1 no se parte en dos: segmented, chip y select a la misma altura
      const tops = await page.evaluate(() => {
        const t = (el: Element | null | undefined) => Math.round(el!.getBoundingClientRect().top)
        const seg = document.querySelector('[role="group"][aria-label="Rango"]')
        const chip = [...document.querySelectorAll('button')].find((b) => /^Rango de fechas/.test(b.getAttribute('aria-label') || ''))
        const sel = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Todos los usuarios')
        return [t(seg), t(chip), t(sel)]
      })
      expect(Math.max(...tops) - Math.min(...tops), `${w}: segmented/chip/select en una fila ${tops}`).toBeLessThanOrEqual(6)
    }

    // editar el rango a mano: ningún atajo queda activo
    await page.goto('/app/historial?hDesde=2026-10-01&hHasta=2026-10-15')
    await esperarCarga(page)
    if (w < 768) await page.getByRole('button', { name: 'Mostrar filtros' }).click()
    await expect(page.getByRole('group', { name: 'Rango' }).locator('button[aria-pressed="true"]')).toHaveCount(0)
  }
})

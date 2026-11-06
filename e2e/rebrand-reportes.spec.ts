import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Reportes: el primer pantallazo trae datos (KPIs sin scrollear), controles en la
// zona sticky y sin textos cortados. Solo lectura.
test('reportes mobile 390x844: KPIs visibles, chip de rango y menú Compartir', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/reportes')
  await esperarCarga(page)

  // los 4 KPIs entran completos en el primer pantallazo
  for (const nombre of ['Ingresos', 'Egresos', 'Neto', 'Ticket promedio']) {
    const tile = page.locator('[data-card-compacta]').filter({ hasText: nombre }).first()
    await expect(tile, nombre).toBeVisible()
    const b = (await tile.boundingBox())!
    expect(b.y + b.height, `${nombre} dentro del viewport`).toBeLessThan(844 - 60)
  }
  // texto corregido
  await expect(page.getByText(/Promedio mensual/)).toBeVisible()
  await expect(page.getByText(/Promedio por/)).toHaveCount(0)

  // chip de rango y toggle de moneda sin truncar
  const chip = page.getByRole('button', { name: /^Rango de fechas/ })
  const t = await chip.evaluate((e) => { const s = e.querySelector('span')!; return s.scrollWidth <= s.clientWidth + 1 })
  expect(t, 'el rango de fechas entra entero').toBe(true)

  // el chip abre un bottom sheet con los dos selectores; "Listo" lo cierra
  await chip.click()
  await expect(page.getByRole('heading', { name: 'Rango de fechas' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Desde/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Hasta/ })).toBeVisible()
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('heading', { name: 'Rango de fechas' })).toHaveCount(0)

  // Compartir: menú con las 3 acciones; click afuera lo cierra (sin ejecutar ninguna)
  await page.getByRole('button', { name: 'Compartir' }).click()
  await expect(page.getByRole('menuitem')).toHaveCount(3)
  await page.mouse.click(200, 700)
  await expect(page.getByRole('menuitem')).toHaveCount(0)

  // períodos: cambiar el segmented actualiza "Promedio …"
  for (const [btn, texto] of [['Diario', 'Promedio diario'], ['Semanal', 'Promedio semanal'], ['Anual', 'Promedio anual'], ['Mensual', 'Promedio mensual']]) {
    await page.getByRole('button', { name: btn, exact: true }).click()
    await expect(page.getByText(new RegExp(texto))).toBeVisible()
  }
})

test('reportes desktop 1440: KPIs en una fila y acciones como íconos', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/reportes')
  await esperarCarga(page)
  const ys = await page.locator('[data-card-compacta]').evaluateAll((els) =>
    els.filter((e) => /Ingresos|Egresos|Neto|Ticket promedio/.test(e.textContent || '') && !(e.textContent || '').includes('Proyección'))
      .slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top)))
  expect(new Set(ys).size, 'los 4 tiles en la misma fila').toBe(1)
  for (const n of ['WhatsApp', 'Descargar CSV', 'Imprimir / PDF']) await expect(page.getByRole('button', { name: n })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compartir' })).toBeHidden()
})

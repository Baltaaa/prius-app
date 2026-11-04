import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Leads: lista compacta con expansión (mobile) y lista + panel (desktop), con 3 leads
// simulados en el navegador (la lectura real no se toca). Nunca se pulsa una acción.
const mk = (i: number, estado: string, msg: string) => ({
  id: `00000000-0000-0000-0000-00000000000${i}`, nombre: `Lead Prueba ${i}`, email: `lead${i}@example.com`, telefono: `+54 9 223 555 000${i}`,
  telefono_normalizado: `+54922355500${i}0`, asunto: 'Consulta carpa', mensaje: msg, estado, origen: 'web',
  created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
})

test('leads mobile y desktop', async ({ page }) => {
  test.setTimeout(240_000)
  await page.route(/\/rest\/v1\/leads\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({ json: [mk(1, 'nuevo', 'Hola, quiero una carpa para enero.\nSomos 4.'), mk(2, 'contactado', 'Consulta por sombrilla'), mk(3, 'descartado', 'Spam')] })
  })
  await login(page)

  // ── mobile
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/leads')
  await esperarCarga(page)
  await expect(page.getByText('Lead Prueba 1').first()).toBeVisible()
  const filas = page.locator('[data-deeplink-id] > button')
  for (let i = 0; i < 3; i++) {
    const b = (await filas.nth(i).boundingBox())!
    expect(b.height, `fila ${i} entre 72 y 84px`).toBeGreaterThanOrEqual(72)
    expect(b.height).toBeLessThanOrEqual(84)
  }
  // tabs con contador, una sola línea
  await expect(page.getByRole('button', { name: 'Todo 3' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sin contactar 1' })).toBeVisible()
  const tops = await page.getByRole('group', { name: 'Estado del lead' }).getByRole('button').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))])
  expect(tops.length).toBe(1)
  // expandir: uno a la vez
  await filas.nth(0).click()
  await page.waitForTimeout(400)
  for (const n of ['WhatsApp', 'Llamar', 'Email', 'Copiar', 'Descartar']) await expect(page.getByRole(n === 'Llamar' || n === 'Email' ? 'link' : 'button', { name: n })).toBeVisible()
  await expect(page.getByRole('button', { name: /Marcar contactado/ })).toBeVisible()
  await filas.nth(1).click()
  await page.waitForTimeout(400)
  await expect(filas.nth(0)).toHaveAttribute('aria-expanded', 'false')
  await expect(filas.nth(1)).toHaveAttribute('aria-expanded', 'true')
  expect(await page.locator('[data-deeplink-id] > button[aria-expanded="true"]').count()).toBe(1)
  // buscador
  await page.getByPlaceholder(/Buscar nombre/).fill('sombrilla')
  await expect(page.locator('[data-deeplink-id]')).toHaveCount(1)
  // footer: no está en la pantalla; vive en "Más"
  await expect(page.getByText('Sector Carpas y Balneario').first()).toBeHidden()
  await page.getByRole('button', { name: 'Más' }).click()
  await expect(page.getByText('Sector Carpas y Balneario').last()).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)

  // ── desktop
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/leads')
  await esperarCarga(page)
  await expect(page.getByText('Elegí un lead')).toBeVisible()
  await page.getByText('Lead Prueba 1').first().click()
  await expect(page.getByRole('heading', { name: 'Lead Prueba 1', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'WhatsApp' })).toBeVisible()
  await expect(page.getByText('Sector Carpas y Balneario', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})

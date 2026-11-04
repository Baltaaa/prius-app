import { test, expect, login } from './fixtures'
const OUT = 'design/rebrand-shots/recepcion'
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const ahora = new Date().toISOString()

// Datos de prueba inyectados SOLO en la respuesta del navegador (no se escribe nada en la base).
const mkReserva = (n: number, codigo: string, nombre: string, unidad: { tipo: string; numero: number }, valor: number) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`, codigo, origen: 'web', estado: 'activa', preconfirmada: false, tipo_alquiler: 'dia', fecha: hoy,
  valor_total: valor, saldo: valor, estado_pago: 'pendiente', cantidad_personas: 3, bonificada: false, unidad_id: `u-${n}`, cliente_id: `c-${n}`,
  clientes: { id: `c-${n}`, nombre, apellido: '', telefono: '+5492236000000' }, unidades: { id: `u-${n}`, ...unidad }, reserva_clientes: [], reserva_grupos: null,
})
// Recepción nueva (Bloques 6 y 6B), solo lectura: inyecta reservas y códigos de prueba
// en la RESPUESTA del navegador (nada se escribe en la base) y prueba con clicks
// reales el input estricto, el pegado, el modo Lector, la lista y el botón Check-in
// (que solo abre la reserva: nunca se confirma un check-in ni un cobro).
test('recepción', async ({ page }) => {
  test.setTimeout(240_000)
  await page.route(/\/rest\/v1\/reservas\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const resp = await route.fetch(); const data = await resp.json()
    data.push(mkReserva(1, 'PRIUS-A3X9K2', 'Julieta Romero', { tipo: 'carpa', numero: 41 }, 120000), mkReserva(2, 'PRIUS-779C5Z', 'Pedro Gimenez', { tipo: 'sombrilla', numero: 12 }, 80000), mkReserva(3, 'PRIUS-ZZ22KK', 'Lucia Perez', { tipo: 'carpa', numero: 7 }, 95000))
    await route.fulfill({ response: resp, json: data })
  })
  await page.route(/\/rest\/v1\/codigos_reserva\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const resp = await route.fetch(); const data = await resp.json()
    const base = { metodo_pago_previsto: 'efectivo', unidades_contiguas: true, checkin_por: null, created_at: ahora }
    data.push({ ...base, codigo: 'PRIUS-A3X9K2', checkin_at: null }, { ...base, codigo: 'PRIUS-ZZ22KK', checkin_at: ahora })
    const i = data.findIndex((c: { codigo: string }) => c.codigo === 'PRIUS-779C5Z'); if (i >= 0) data.splice(i, 1)
    data.push({ ...base, codigo: 'PRIUS-779C5Z', checkin_at: null })
    await route.fulfill({ response: resp, json: data })
  })
  const cargar = async () => {
    await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 })
    await expect(page.getByText('Julieta Romero')).toBeVisible({ timeout: 40_000 })
    await page.waitForTimeout(500)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/app/recepcion'); await cargar()
  await page.screenshot({ path: `${OUT}/recepcion-1440.png` })

  // --- input estricto ---
  const campo = page.getByLabel(/Código de reserva: 6 caracteres/)
  await campo.fill('a3x-9k0')            // - y 0 no van
  await expect(campo).toHaveValue('A3X9K')
  await expect(page.getByText(/Acá van letras/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buscar reserva' })).toBeDisabled()
  await campo.press('Enter')
  await expect(page.getByText('Código incompleto')).toBeVisible()
  await campo.fill('')
  // pegado inválido: no carga nada
  await campo.focus()
  await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text', 'hola mundo'); document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
  await expect(campo).toHaveValue('')
  await expect(page.getByText(/No se cargó nada/)).toBeVisible()
  // pegado válido en minúsculas y con espacios: llena y busca solo
  await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text', ' prius-a3x 9k2 '); document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
  await expect(campo).toHaveValue('A3X9K2')
  await expect(page).toHaveURL(/codigo=PRIUS-A3X9K2/)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/recepcion-cargada-1440.png` })
  // código con formato válido que no existe
  await campo.fill('')
  await campo.fill('BBBBBB')
  await expect(page.getByText('No encontramos una reserva con ese código')).toBeVisible()
  // código real con dígitos en cualquier posición (PRIUS-779C5Z) se acepta
  await campo.fill('779c5z')
  await expect(campo).toHaveValue('779C5Z')
  await page.waitForTimeout(500)
  await expect(page.getByText('No encontramos una reserva con ese código')).toHaveCount(0)

  // --- modo Lector ---
  await page.getByRole('button', { name: 'Lector' }).click()
  const lector = page.getByLabel('Lector de código de reserva')
  await expect(lector).toBeFocused()
  await lector.fill('PRIUS-ZZ22KK'); await lector.press('Enter')
  await expect(page).toHaveURL(/codigo=PRIUS-ZZ22KK/)
  await lector.fill('hola mundo'); await lector.press('Enter')
  await expect(page.getByText(/no es de una reserva/)).toBeVisible()
  await page.screenshot({ path: `${OUT}/recepcion-lector-1440.png` })

  // --- lista: filtros y botones ---
  await page.goto('/app/recepcion'); await cargar()
  await page.getByRole('button', { name: 'Pendientes' }).click()
  const lista = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Llegan hoy' }) })
  await expect(lista.getByText('Lucia Perez')).toHaveCount(0)
  await expect(lista.getByText('Julieta Romero')).toBeVisible()
  await page.getByRole('button', { name: 'Todos' }).click()
  await expect(page.getByRole('button', { name: 'Ingresó' })).toBeDisabled()
  await page.getByRole('button', { name: 'Check-in' }).first().click()
  await expect(page).toHaveURL(/codigo=PRIUS-/)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/recepcion-checkin-1440.png` })

  // --- mobile ---
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/recepcion'); await cargar()
  await page.screenshot({ path: `${OUT}/recepcion-390.png`, fullPage: false })
  await page.evaluate(() => document.querySelector('#app-main-scroll')!.scrollTo(0, 99999)); await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/recepcion-390-abajo.png` })
  const sh = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log('SCROLL-H 390', sh)
})

import { test, expect, login } from './fixtures'

/**
 * Fase 6A.1 (nov 2026): MarcoPlanoClaro como marco del flujo de reserva de la
 * landing, probado con clicks reales en /app/dev/marco-reserva (herramienta
 * de desarrollo, solo lectura: disponibilidad_publica). Cubre barra del paso,
 * pie fijo por portal, cuerpo libre con scroll interno, slots de fecha y
 * personas, refrescar, chips deshabilitados, aviso y la API del mapa
 * (mapaRef + onCambioZoom) con "el primer toque acerca" implementado afuera.
 */

async function abrir(page) {
  const errores: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()) })
  page.on('pageerror', (e) => errores.push(e.message))
  await login(page)
  await page.goto('/app/dev/marco-reserva')
  await expect(page.getByText('Cargando plano…')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('[data-celda]').first()).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => page.locator('[data-escala]').getAttribute('data-escala')).not.toBe('')
  return errores
}

const escala = async (page) => Number(await page.locator('[data-escala]').getAttribute('data-escala'))
const encuadre = async (page) => Number(await page.locator('[data-encuadre]').getAttribute('data-encuadre'))

// Una celda libre cerca del centro del mapa visible (el toque acerca ahí).
async function celdaLibre(page) {
  const sel = await page.evaluate(() => {
    const vista = document.querySelector('[data-cuerpo-marco], section[data-card-compacta]:last-of-type')
    const botones = [...document.querySelectorAll('[data-celda]')] as HTMLElement[]
    const libres = botones.filter((b) => b.className.includes('bg-white') && !/opacity-(20|30)\b/.test(b.className))
    const r0 = (vista || document.body).getBoundingClientRect()
    const cx = r0.left + r0.width / 2
    const cy = r0.top + r0.height / 2
    libres.sort((a, b) => {
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      return Math.hypot(ra.x - cx, ra.y - cy) - Math.hypot(rb.x - cx, rb.y - cy)
    })
    return libres[0]?.getAttribute('data-celda')
  })
  expect(sel).toBeTruthy()
  return page.locator(`[data-celda="${sel}"]`)
}

async function tocarCentro(page, loc) {
  const box = await loc.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

async function recorrido(page, amplia: boolean) {
  const errores = await abrir(page)
  const hoja = page.locator('[data-hoja-marco]')

  // Header: slots de fecha y personas, refrescar; X solo en amplia.
  await expect(page.locator('[data-slot-fecha]')).toBeVisible()
  await page.locator('[data-slot-personas]').click()
  await expect(page.locator('[data-slot-personas]')).toHaveText('3 personas')
  await expect(hoja.getByRole('button', { name: 'Cerrar', exact: true })).toHaveCount(amplia ? 1 : 0)
  await expect(hoja.getByRole('button', { name: 'Cerrar pantalla completa' })).toHaveCount(0)

  // Fase 6A.2: data-marco-plano en la raíz, data-cuerpo-marco también con el
  // mapa, y la leyenda en la fila "Pasillo A · B · C" (misma línea, a la derecha).
  await expect(hoja.locator('[data-marco-plano]')).toHaveCount(1)
  const cuerpoMapa = hoja.locator('[data-cuerpo-marco]')
  await expect(cuerpoMapa).toHaveCount(1)
  const leyenda = cuerpoMapa.locator('[data-leyenda]')
  await expect(leyenda).toBeVisible()
  const bRotulo = await cuerpoMapa.getByText('Pasillo A · B · C').boundingBox()
  const bLeyenda = await leyenda.boundingBox()
  expect(Math.abs((bRotulo.y + bRotulo.height / 2) - (bLeyenda.y + bLeyenda.height / 2))).toBeLessThan(4)
  expect(bLeyenda.x).toBeGreaterThan(bRotulo.x + bRotulo.width)
  const bCuerpo = await cuerpoMapa.boundingBox()
  expect(bLeyenda.x + bLeyenda.width).toBeLessThanOrEqual(bCuerpo.x + bCuerpo.width)

  // Barra del paso y pie fijo (por portal) pegado abajo de la hoja.
  await expect(page.locator('[data-barra-paso]')).toContainText('Paso 3 de 6')
  const pie = page.locator('[data-pie-marco]')
  await expect(pie.getByRole('button', { name: 'Siguiente' })).toBeVisible()
  const bHoja = await hoja.boundingBox()
  const bPie = await pie.boundingBox()
  expect(bHoja.y + bHoja.height - (bPie.y + bPie.height)).toBeLessThanOrEqual(32)

  // onCambioZoom: arranca encuadrado.
  expect(Math.abs((await escala(page)) - (await encuadre(page)))).toBeLessThan(0.01)

  // Primer toque acerca (lógica afuera de la carpeta, vía mapaRef); los
  // siguientes, cuando la celda ya se ve grande, la eligen.
  const celda = await celdaLibre(page)
  await tocarCentro(page, celda)
  await expect(hoja.getByRole('status')).toHaveText('Tocá de nuevo para elegir')
  await expect.poll(() => escala(page), { timeout: 3000 }).toBeGreaterThan(await encuadre(page) * 1.3)
  await expect(celda).not.toHaveAttribute('aria-pressed', 'true')
  for (let i = 0; i < 6; i += 1) {
    if ((await celda.getAttribute('aria-pressed')) === 'true') break
    await page.waitForTimeout(700)
    await tocarCentro(page, celda)
    await page.waitForTimeout(500)
  }
  await expect(celda).toHaveAttribute('aria-pressed', 'true')

  // Refrescar: llama al callback (vuelve a leer la disponibilidad).
  const antes = Number(await page.locator('[data-lecturas]').getAttribute('data-lecturas'))
  await hoja.getByRole('button', { name: 'Actualizar disponibilidad' }).click()
  await expect.poll(async () => Number(await page.locator('[data-lecturas]').getAttribute('data-lecturas'))).toBe(antes + 1)

  // Paso 4: cuerpo libre con scroll interno; la página no scrollea, el pie sigue en su lugar.
  await pie.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.locator('[data-barra-paso]')).toContainText('Paso 4 de 6')
  await expect(page.locator('[data-contenido-libre]')).toBeVisible()
  await expect(hoja.locator('[data-cuerpo-marco]')).toHaveCount(1)
  await expect(hoja.locator('[data-leyenda]')).toHaveCount(0)
  await expect(hoja.getByRole('group', { name: 'Filtrar el plano por tipo de unidad' }).getByRole('button', { name: 'Todo' })).toBeDisabled()
  const scroll = page.locator('[data-scroll-cuerpo]')
  const dims = await scroll.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }))
  expect(dims.sh).toBeGreaterThan(dims.ch)
  await scroll.hover()
  await page.mouse.wheel(0, 600)
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(0)
  const bPie2 = await pie.boundingBox()
  expect(Math.abs(bPie2.y - bPie.y)).toBeLessThan(1)
  await expect(page.getByText('Paso 4 · renglón 40')).toBeAttached()

  // Volver al mapa: chips habilitados, el mapa vuelve a medir y avisar.
  await pie.getByRole('button', { name: 'Volver' }).click()
  await expect(page.locator('[data-celda]').first()).toBeVisible()
  await expect(hoja.getByRole('group', { name: 'Filtrar el plano por tipo de unidad' }).getByRole('button', { name: 'Todo' })).toBeEnabled()
  await expect.poll(() => escala(page)).toBeGreaterThan(0)

  expect(errores).toEqual([])
}

test.describe('Marco de reserva — amplia', () => {
  test('desktop', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'Solo desktop-1440')
    await recorrido(page, true)
  })
})

test.describe('Marco de reserva — compacta', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('mobile 390', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'Corre una vez, con viewport de 390')
    await recorrido(page, false)
  })
})

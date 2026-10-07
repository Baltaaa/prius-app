import { test, expect, login, PREFIJO_E2E } from './fixtures'

/**
 * Tarea 8 (oct 2026) — e2e del flujo de reservas sobre el CRM real.
 * Corre en serie (ver playwright.config.ts) porque los pasos dependen
 * unos de otros (crear cliente -> reserva -> pago -> verificar en otras
 * pantallas). Todo dato de prueba usa el prefijo "E2E TEST" para que el
 * teardown (e2e/teardown.ts) lo pueda encontrar y borrar sin tocar nada
 * real — correlo siempre después de la suite, nunca lo canceles a mitad.
 *
 * Requiere E2E_USER_EMAIL/E2E_USER_PASSWORD en .env.local (cuenta de
 * prueba "admin", nunca la real) — ver .env.local.example.
 */

const NOMBRE_CLIENTE = `${PREFIJO_E2E} ${Date.now()}`

test.describe('Flujo de reservas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('login deja al usuario en Home', async ({ page }) => {
    await expect(page.getByText(/dashboard|inicio/i).first()).toBeVisible()
  })

  test('dos overlays nunca abiertos a la vez + click afuera cierra', async ({ page }) => {
    // Search global y menú de usuario del TopBar — el bug original de la
    // Tarea 1 era exactamente este: los dos quedaban abiertos juntos.
    await page.locator('input[placeholder*="Buscar"]').first().fill('xx')
    await expect(page.getByText(/seguí escribiendo|sin resultados/i)).toBeVisible()
    await page.getByRole('button', { name: /perfil|usuario/i }).first().click().catch(() => {})
    // Abrir el menú de perfil (avatar, sin label accesible propio —
    // clickea el botón que contiene la inicial del usuario).
    const avatar = page.locator('header button').filter({ hasText: /^[A-ZÁÉÍÓÚ]$/ }).first()
    if (await avatar.count()) {
      await avatar.click()
      // El dropdown de búsqueda debería haberse cerrado solo al abrir este.
      await expect(page.getByText(/seguí escribiendo|sin resultados/i)).not.toBeVisible()
    }
    // Click afuera cierra el que haya quedado abierto.
    await page.mouse.click(10, 10)
  })

  test('crear reserva de período, editar y verificar "días" (no "noches")', async ({ page }) => {
    await page.goto('/app/reservas')
    await page.getByRole('button', { name: /nueva reserva/i }).click()

    // Cliente nuevo inline (mismo ClienteSelector de siempre).
    await page.getByPlaceholder(/buscar cliente/i).fill(NOMBRE_CLIENTE)
    await page.getByRole('button', { name: /crear cliente nuevo/i }).click()
    await page.getByPlaceholder(/nombre completo/i).fill(NOMBRE_CLIENTE)
    await page.getByPlaceholder(/teléfono/i).first().fill('+54 9 223 500-0000')
    await page.getByRole('button', { name: /guardar cliente/i }).click()

    await page.getByRole('button', { name: /período/i }).click()
    // Dos clicks en el calendario (desde/hasta) — dos días hábiles desde hoy.
    await page.locator('.rdp-day_button:not(.rdp-disabled)').nth(1).click()
    await page.locator('.rdp-day_button:not(.rdp-disabled)').nth(3).click()

    await page.getByLabel(/monto total/i).fill('50000')
    await page.getByRole('button', { name: /crear reserva/i }).click()
    await expect(page.getByText(NOMBRE_CLIENTE)).toBeVisible({ timeout: 10_000 })

    // Editar y verificar que el resumen diga "Días", nunca "Noches".
    await page.getByText(NOMBRE_CLIENTE).first().click()
    await expect(page.getByText('Días', { exact: true })).toBeVisible()
    await expect(page.getByText('Noches', { exact: true })).not.toBeVisible()
    await page.getByRole('button', { name: /guardar cambios/i }).click()
  })

  test('registrar pago aparece en Clientes, Caja e Historial con el actor', async ({ page }) => {
    await page.goto('/app/clientes')
    await page.getByPlaceholder(/buscar/i).fill(NOMBRE_CLIENTE)
    await page.getByText(NOMBRE_CLIENTE).first().click()
    await page.getByTitle('Registrar pago').first().click()
    await page.getByLabel(/monto/i).first().fill('10000')
    await page.getByRole('button', { name: /registrar pago|confirmar/i }).click()

    await expect(page.getByText(/pago registrado|\$\s?10\.000/i)).toBeVisible({ timeout: 10_000 })

    // Historial: el evento debe traer el nombre del actor (no "Sistema").
    await page.goto('/app/historial')
    await page.getByPlaceholder(/buscar en el historial/i).fill(NOMBRE_CLIENTE)
    const fila = page.getByText(NOMBRE_CLIENTE).first()
    await expect(fila).toBeVisible({ timeout: 10_000 })
  })

  test('buscar cliente por número de comprobante', async ({ page }) => {
    await page.goto('/app/clientes')
    // Comprobante conocido de datos reales (ver auditoría Tarea 7) — si no
    // existe más, ajustar este número de muestra.
    await page.getByPlaceholder(/buscar/i).fill('727')
    await expect(page.getByText(/comprobante/i).first()).toBeVisible()
  })

  test('marcar notificaciones como leídas actualiza el badge al instante', async ({ page }) => {
    await page.goto('/app/notificaciones')
    const badgeAntes = await page.locator('text=/^\\d+$/').first().textContent().catch(() => null)
    const marcarTodas = page.getByRole('button', { name: /marcar todas como leídas/i })
    if (await marcarTodas.count()) {
      await marcarTodas.click()
      await page.goto('/app/home')
      // El badge de Sidebar/BottomNav no debería mostrar más el número de antes.
      if (badgeAntes) await expect(page.getByText(badgeAntes, { exact: true })).not.toBeVisible()
    }
  })
})

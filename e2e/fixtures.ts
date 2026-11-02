import { test as base, expect } from '@playwright/test'
import { instalarGuard } from './guard'

// Credenciales SOLO desde .env.local — nunca hardcodeadas (Tarea 8, oct
// 2026). Si faltan, los tests fallan con un mensaje claro en vez de un
// error críptico de Playwright tratando de loguearse con "undefined".
const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

export const PREFIJO_E2E = 'E2E TEST'

// Con RB_GUARD (playwright.rebrand.config.ts) cada test corre detrás del guard
// de requests y falla si la app intentó una escritura no prevista.
export const test = base.extend<{ guardRequests: void }>({
  guardRequests: [async ({ page }, use, testInfo) => {
    if (!process.env.RB_GUARD) return use()
    const bloqueados = await instalarGuard(page, testInfo.title)
    await use()
    expect(bloqueados, 'requests bloqueados por el guard').toEqual([])
  }, { auto: true }],
})

export async function login(page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Faltan E2E_USER_EMAIL / E2E_USER_PASSWORD en .env.local — ver .env.local.example.')
  }
  await page.goto('/login')
  // Selectores alineados al rediseño del login (oct 2026, Tarea 5) — labels
  // reales en vez de placeholders en mayúscula, botón "Ingresar" sin más
  // texto. Desactualizado desde ese rediseño, nunca se había vuelto a
  // correr test:visual hasta ahora.
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(PASSWORD)
  await page.getByRole('button', { name: /^ingresar$/i }).click()
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 15_000 })
}

export { expect }

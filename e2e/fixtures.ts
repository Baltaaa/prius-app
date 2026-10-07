import { test as base, expect } from '@playwright/test'

// Credenciales SOLO desde .env.local — nunca hardcodeadas (Tarea 8, oct
// 2026). Si faltan, los tests fallan con un mensaje claro en vez de un
// error críptico de Playwright tratando de loguearse con "undefined".
const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

export const PREFIJO_E2E = 'E2E TEST'

export const test = base.extend({})

export async function login(page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Faltan E2E_USER_EMAIL / E2E_USER_PASSWORD en .env.local — ver .env.local.example.')
  }
  await page.goto('/login')
  await page.getByPlaceholder('CORREO ELECTRÓNICO').fill(EMAIL)
  await page.getByPlaceholder('CONTRASEÑA').fill(PASSWORD)
  await page.getByRole('button', { name: /ingresar al panel/i }).click()
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 15_000 })
}

export { expect }

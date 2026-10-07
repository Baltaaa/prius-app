import { defineConfig, devices } from '@playwright/test'

// Tarea 8 (oct 2026) — e2e del flujo de reservas sobre el CRM real (sin
// backend mock: pega contra el Supabase de producción con una cuenta de
// prueba). Credenciales SOLO desde .env.local (E2E_USER_EMAIL/
// E2E_USER_PASSWORD) — nunca hardcodeadas, nunca en un commit.
export default defineConfig({
  testDir: './e2e',
  // Teardown automático al final de la corrida — borra todo lo que haya
  // quedado con prefijo "E2E TEST" (ver e2e/teardown.ts). Corre siempre,
  // incluso si algún test falló, para no dejar basura en producción.
  globalTeardown: './e2e/teardown.ts',
  fullyParallel: false, // los tests comparten estado real (caja, cliente E2E TEST) — en serie, no en paralelo
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})

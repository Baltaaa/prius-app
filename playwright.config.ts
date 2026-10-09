import { defineConfig, devices } from '@playwright/test'

// Carga .env.local al proceso de Playwright (Node 20.6+, sin dependencia
// nueva) — Vite ya lo lee solo para el dev server que arranca `webServer`,
// pero el propio proceso de Playwright (fixtures.ts, teardown.ts) necesita
// E2E_USER_EMAIL/E2E_USER_PASSWORD en su propio process.env. Sin esto la
// suite nunca pudo correr (ver CLAUDE.md "Pendiente").
try {
  process.loadEnvFile('.env.local')
} catch {
  // Sin .env.local (ej. CI con las vars ya seteadas) — fixtures.ts /
  // teardown.ts avisan con su propio mensaje claro si igual faltan.
}

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
    // 'chrome' usa el Google Chrome ya instalado en la máquina en vez del
    // Chromium propio de Playwright — en este entorno (macOS 13) la
    // descarga del Chromium de Playwright está bloqueada, pero el canal
    // 'chrome' no descarga nada, apunta al binario existente.
    channel: 'chrome',
  },
  // Tres tamaños: desktop (todo el e2e de siempre) + dos mobile (solo
  // regresión visual del Plano, ver e2e/plano-visual.spec.ts). Nunca se usan
  // descriptores devices['iPhone...'] para los mobile — esos fuerzan WebKit,
  // y acá el objetivo es reproducir Chrome mobile real (el navegador que usa
  // Mado), no Safari. Se arma el `use` de cada mobile a mano, con
  // devices['Desktop Chrome'] como base Chromium + los flags táctiles.
  projects: [
    {
      name: 'desktop-1440',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-360',
      // Solo el spec visual del Plano corre en los proyectos mobile — el
      // flujo de e2e/reservas.spec.ts crea datos reales contra Supabase y
      // no tiene sentido triplicarlo por tamaño de pantalla.
      testMatch: /plano-visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'mobile-390',
      testMatch: /plano-visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})

import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

// Config del rebranding: pega contra producción, así que corre sin escribir
// nada. Tres diferencias con la config por defecto:
//  - sin globalTeardown (el de siempre borra datos al final de cualquier corrida),
//  - con el guard de e2e/guard.ts activo (lista blanca de requests),
//  - con una cuenta dedicada propia: nunca una cuenta real del equipo.
if (!process.env.E2E_REBRAND_EMAIL || !process.env.E2E_REBRAND_PASSWORD) {
  throw new Error('Faltan E2E_REBRAND_EMAIL / E2E_REBRAND_PASSWORD en .env.local: tiene que ser una cuenta dedicada a tests.')
}
process.env.E2E_USER_EMAIL = process.env.E2E_REBRAND_EMAIL
process.env.E2E_USER_PASSWORD = process.env.E2E_REBRAND_PASSWORD
process.env.RB_GUARD = '1'

const { globalTeardown: _sinTeardown, ...resto } = base

export default defineConfig({
  ...resto,
  // Crea datos reales y auditoría mobile no se usa en el rebranding.
  testIgnore: [/reservas\.spec\.ts/, /auditoria-mobile\.spec\.ts/],
  projects: [
    ...(base.projects || []),
    {
      name: 'tablet-768',
      testMatch: /plano-zoom-minimo\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
  ],
})

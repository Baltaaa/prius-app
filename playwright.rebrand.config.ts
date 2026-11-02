import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

// Config del rebranding: pega contra producción, así que corre sin escribir
// nada. Dos diferencias con la config por defecto: sin globalTeardown (el de
// siempre borra datos al final de cualquier corrida) y con el guard de
// e2e/guard.ts activo (lista blanca de requests).
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

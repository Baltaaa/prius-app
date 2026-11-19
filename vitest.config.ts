import { defineConfig } from 'vitest/config'

export default defineConfig({
  // JSX con el runtime automático (como Vite en la app): los tests que importan
  // componentes .jsx (ej. components/plano/CeldaClara) no necesitan `import React`.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

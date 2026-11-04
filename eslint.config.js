import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'supabase/functions/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      // El BOM (U+FEFF) que CLAUDE.md exige al armar CSVs (Caja, Reportes)
      // vive dentro de un template literal — no-irregular-whitespace no
      // ignora template literals por default y lo marcaba como error.
      'no-irregular-whitespace': ['error', { skipTemplates: true }],
      // Sin eslint-plugin-react (no está en devDependencies), espree no
      // marca un identificador como "usado" por una referencia JSX
      // (<Foo />) — no-unused-vars tira falsos positivos masivos sobre
      // imports de componentes que sí se usan. Se apaga hasta que se agregue
      // ese plugin (o el equivalente de typescript-eslint).
      'no-unused-vars': 'off',
      // "El día" siempre en hora argentina: `toISOString().split('T')[0]` (y
      // slice/substring) es UTC y pasadas las 21:00 ART ya es "mañana". Usar
      // hoyAR() / fechaAR() / sumarDias() de src/lib/fechas.js.
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.property.name=/^(split|slice|substring)$/][callee.object.callee.property.name='toISOString']",
        message: 'No uses toISOString().split/slice/substring para fechas (es UTC). Usá hoyAR()/fechaAR()/sumarDias() de src/lib/fechas.js.',
      }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]

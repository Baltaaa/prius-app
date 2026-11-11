import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Auditoría del modo privacidad: todo monto que se muestra pasa por formatMonto (lib/format.ts).
// Si alguien formatea plata por su cuenta, el ojito global deja ese número a la vista.
const RAIZ = join(__dirname, '..')
const PERMITIDOS = new Set([
  'lib/format.ts',               // el formateador único
  'components/inputs/MoneyInput.tsx', // input de carga: los inputs no se ocultan
  'components/dashboard/ClimaHero.jsx', // metros de ola, no es plata
])

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return archivos(p)
    return /\.(jsx?|tsx?)$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}

describe('montos: un solo formateador', () => {
  const fuentes = archivos(RAIZ).map((p) => ({ rel: p.slice(RAIZ.length + 1).replace(/\\/g, '/'), txt: readFileSync(p, 'utf8') }))

  it('no queda el viejo formatPesos / formatDolares', () => {
    const malos = fuentes.filter((f) => /\bformat(Pesos|Dolares)\b/.test(f.txt.replace(/formatPesosCSV/g, ''))).map((f) => f.rel)
    expect(malos).toEqual([])
  })

  it('nadie arma "$ <número>" a mano ni usa Intl/toLocaleString para plata fuera del formateador', () => {
    const malos: string[] = []
    for (const f of fuentes) {
      if (PERMITIDOS.has(f.rel)) continue
      const sinComentarios = f.txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (/new Intl\.NumberFormat|\.toLocaleString\(/.test(sinComentarios)) malos.push(`${f.rel}: Intl/toLocaleString`)
      if (/`[^`]*\$\$\{/.test(sinComentarios)) malos.push(`${f.rel}: "$" + \${...}`)
      if (/['"]\$\s?['"]\s*\+/.test(sinComentarios)) malos.push(`${f.rel}: "$" + valor`)
    }
    expect(malos).toEqual([])
  })

  it('las variantes *Real (que ignoran la privacidad) solo se usan en impresión y exportación', () => {
    const ok = new Set([
      'lib/format.ts', 'lib/format.test.ts',
      'components/crm/CajaImpresion.jsx', 'components/crm/ClientesImpresion.jsx',
      'components/crm/ComprobanteDocumento.jsx', 'lib/export/reportesExport.js',
    ])
    const usos = fuentes.filter((f) => /\bformatMonto(Compacto|USD)?Real\b/.test(f.txt)).map((f) => f.rel).filter((r) => !ok.has(r))
    expect(usos).toEqual([])
  })
})

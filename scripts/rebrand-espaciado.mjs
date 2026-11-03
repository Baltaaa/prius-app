// Codemod del sistema de espaciado (design/DESIGN.md, "Espaciado"): pasa los
// valores fuera de la escala de 4px a la escala y el padding de las cards al
// token. Idempotente. `node scripts/rebrand-espaciado.mjs [--dry]`.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CONGELADOS = /CajaImpresion|PlanoImpresion|ComprobanteDocumento|ComprobanteImpresionDoble|imprimirDocumento|dashboard\/Cell\.jsx|dashboard\/CellMobile\.jsx|components\/plano\/|CeldaPublica/
const LEGACY = { xs: '1', sm: '2', md: '4', lg: '6', xl: '9' }
const MEDIOS = { '0.5': '1', '1.5': '2', '2.5': '3', '3.5': '4' }
const PREFIJO = '(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)'
const reLegacy = new RegExp(`(?<![\\w-])(-?${PREFIJO})-space-(xs|sm|md|lg|xl)\\b`, 'g')
const reMedio = new RegExp(`(?<![\\w-])(-?${PREFIJO})-(0\\.5|1\\.5|2\\.5|3\\.5)(?![\\w.])`, 'g')

function recorrer(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n)
    if (statSync(r).isDirectory()) recorrer(r, acc)
    else if (/\.(jsx|tsx)$/.test(n)) acc.push(r)
  }
  return acc
}

// Padding propio de una card: se reemplaza por `card-pad`. Los contenedores de
// pills (p-1, p-2) y las cards que ya no llevan padding quedan como están.
const rePadCard = /(?<![\w-])(?:(?:sm|md|lg):)?p-(?:[4-9]|1\d|20)\b ?/g
function normalizarCard(linea) {
  // Modales y sheets llevan su propio padding (32px); no son cards de página.
  if (!/card-surface/.test(linea) || /rounded-full|card-pad|ui-open|rounded-t-card|plano-fullscreen/.test(linea)) return linea
  const grande = /(?<![\w-])p-(?:8|10|12|20)\b/.test(linea)
  if (!rePadCard.test(linea)) { rePadCard.lastIndex = 0; return linea }
  rePadCard.lastIndex = 0
  const limpio = linea.replace(rePadCard, '')
  return limpio.replace('card-surface', grande ? 'card-surface card-pad py-10' : 'card-surface card-pad')
}

let cambios = 0
for (const archivo of recorrer('src')) {
  if (CONGELADOS.test(archivo)) continue
  const original = readFileSync(archivo, 'utf8')
  const nuevo = original.split('\n').map((l) => {
    let x = l.replace(reLegacy, (_, p, k) => `${p}-${LEGACY[k]}`).replace(reMedio, (_, p, m) => `${p}-${MEDIOS[m]}`)
    return /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(x) ? x : normalizarCard(x)
  }).join('\n')
  if (nuevo !== original) { cambios++; if (!process.argv.includes('--dry')) writeFileSync(archivo, nuevo) }
}
console.log(`${cambios} archivos`)

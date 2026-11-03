// Auditoría del sistema de diseño (design/DESIGN.md): busca en src/ colores,
// fuentes, sombras, radios y tamaños fuera de los tokens. `node scripts/audit-design.mjs`
// sale con código 1 si encuentra algo. Las excepciones están documentadas acá.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const EXCEPCIONES = [
  // Vistas de impresión A4: conservan su estilo propio.
  /CajaImpresion|PlanoImpresion|ComprobanteDocumento|ComprobanteImpresionDoble|imprimirDocumento/,
  // Mapa del plano y colores de estado: congelados.
  /dashboard\/Cell\.jsx|dashboard\/CellMobile\.jsx|components\/plano\/|lib\/colors\.ts/,
  // Tipos generados y tests.
  /database\.types\.ts|\.test\.ts/,
  // Colores de marca de terceros.
  /WhatsAppIcon/,
]

// Chrome denso del Plano (franja de estadísticas, leyenda, toolbar): conserva sus medios pasos para no
// achicar el mapa, cuyo tamaño fijan los snapshots de test:visual.
const ESPACIADO_DENSO = /PlanoStatsBar|PlanoLeyenda|ClimaChip|pages\/Dashboard\.jsx/

const REGLAS = [
  ['hex', /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/],
  ['rgb', /\brgba?\(/],
  ['color Tailwind', /(?<![\w-])(?:bg|text|border|ring|divide|placeholder|accent|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/],
  ['token viejo', /(?<![\w-])(?:bg|text|border|ring|divide)-(?:prius-[a-z]+|hairline|accent-(?:soft|ink)|info-(?:soft|ink)|warning-(?:soft|ink))\b|\b(?:card-light|popover-light|glass-popover)\b/],
  ['fuente', /font-(?:serif|mono|ui|display)\b|fontFamily|font-family/],
  ['sombra', /(?<![\w-])shadow(?:-(?:sm|md|lg|xl|2xl|inner)|-\[)/],
  ['radio', /(?<![\w-])rounded(?:-[trblse]{1,2})?-(?:sm|md|lg|xl|2xl|3xl|\[)/],
  ['tamaño', /(?<![\w-:])text-(?:xs|sm|lg|xl|2xl|3xl|4xl)\b|text-\[(?:[0-9.]+)px\]/],
  // Espaciado (DESIGN.md, "Espaciado"): escala de 4px y tokens del sistema.
  ['espaciado arbitrario', /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y)-\[/],
  ['espaciado fuera de escala', /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(?:0\.5|1\.5|2\.5|3\.5)(?![\w.])/],
  ['espaciado viejo', /(?<![\w-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(?:space-(?:xs|sm|md|lg|xl)|margin(?:-desktop|-mobile|-tablet)?|gutter(?:-sm|-lg)?)\b/],
  ['padding de card', /card-surface(?!.*(?:card-pad|rounded-full|ui-open|rounded-t-card)).*(?<![\w-])(?:(?:sm|md|lg):)?p-(?:[3-9]|1\d|20)\b/],
  ['mayúsculas', /(?<=["'`\s])uppercase(?=["'`\s])/],
]

// Excepción por línea: la bajada de 12px de la bottom nav y el contador, que
// por tamaño físico no entran a 13px.
// data-card-compacta: franja de controles del Plano y su pantalla completa; conservan el padding chico
// para no achicar el mapa (los snapshots de test:visual fijan su tamaño).
const TOLERADAS = [/data-card-compacta/, /(?:p|pt|pb|px|py)-\[max\([^\]]*env\(safe-area/, /text-\[12px\]/, /text-\[10px\] font-semibold flex items-center justify-center/, /text-\[20px\] leading-7/, /text-\[clamp\(/]

function recorrer(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n)
    if (statSync(r).isDirectory()) recorrer(r, acc)
    else if (/\.(jsx|tsx|js|ts|css)$/.test(n)) acc.push(r)
  }
  return acc
}

const hallazgos = []
for (const archivo of recorrer('src')) {
  if (EXCEPCIONES.some((e) => e.test(archivo))) continue
  readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
    if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(linea)) return
    if (!/className|class=|['"`]/.test(linea) && !archivo.endsWith('.css')) return
    // index.css define los tokens: `rgb(var(--x))` es leer un token, y la
    // sección de plano congelado guarda valores propios a propósito.
    if (/rgb\(var\(/.test(linea)) return
    if (archivo.endsWith('.css') && /font-family: 'Manrope|^\s+(background|border|box-shadow): .*rgba\(/.test(linea)) return
    for (const [regla, re] of REGLAS) {
      if (regla === 'espaciado fuera de escala' && ESPACIADO_DENSO.test(archivo)) continue
      if (re.test(linea) && !TOLERADAS.some((t) => t.test(linea))) hallazgos.push(`${archivo}:${i + 1} [${regla}] ${linea.trim().slice(0, 100)}`)
    }
  })
}

const porRegla = {}
for (const h of hallazgos) { const r = h.match(/\[(.+?)\]/)[1]; porRegla[r] = (porRegla[r] || 0) + 1 }
if (process.argv.includes('--resumen')) console.log(porRegla)
else hallazgos.forEach((h) => console.log(h))
console.log(`\n${hallazgos.length} hallazgos`)
process.exit(hallazgos.length ? 1 : 0)

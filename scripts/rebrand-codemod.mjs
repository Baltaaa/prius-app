// Codemod del rebranding (tabla de mapeo aprobada en Fase 1, design/DESIGN.md).
// Reescribe clases viejas de Tailwind a los tokens nuevos, token por token:
// nunca toca líneas que son solo comentario.
//
// Queda en el repo hasta terminar el rebranding: si un hotfix de main entra
// con clases viejas, se corre de nuevo sobre esos archivos.
//   node scripts/rebrand-codemod.mjs              (todo src/)
//   node scripts/rebrand-codemod.mjs src/foo.jsx  (archivos puntuales)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Colores de estado del plano y vistas de impresión: no se reestilizan.
const FROZEN = /(dashboard\/Cell\.jsx|dashboard\/CellMobile\.jsx|components\/plano\/|lib\/colors\.ts)/
const PRINT = /(PlanoImpresion|ComprobanteDocumento|ComprobanteImpresionDoble|CajaImpresion|imprimirDocumento|\.test\.ts|database\.types)/
// Hero oscuro: acá las transparencias blancas son texto sobre foto, no el
// resto del tema oscuro viejo.
const HERO_OSCURO = /pages\/Login\.jsx/
// Dorado sobre negro: único contexto donde el dorado se usa como texto.
const DORADO_SOBRE_NEGRO = /(GlobalLoader\.jsx|EscanearQR\.jsx|pages\/Login\.jsx)/

const FROZEN_MAP = {
  'text-prius-slate': 'text-plano-slate',
  'text-prius-muted': 'text-plano-muted',
  'border-hairline': 'border-plano-line',
  'bg-prius-surface': 'bg-plano-surface',
  'bg-prius-subtle': 'bg-plano-subtle',
  'bg-prius-success': 'bg-plano-success',
  'rounded-md': 'rounded-plano-md',
}

const EXACTO = {
  'text-black': 'text-ink', 'bg-black': 'bg-ink', 'border-black': 'border-ink',
  'text-white': 'text-on-ink', 'bg-white': 'bg-card', 'border-white': 'border-card',
  'bg-white/90': 'bg-card/90', 'bg-black/20': 'bg-surface',

  'text-prius-slate': 'text-ink-2', 'text-prius-muted': 'text-ink-2', 'placeholder-prius-muted': 'placeholder-ink-2',
  'bg-prius-slate': 'bg-ink-2', 'bg-prius-slate/30': 'bg-ink-2/30',

  'border-hairline': 'border-line', 'bg-hairline': 'bg-line', 'divide-hairline': 'divide-divider', 'text-hairline': 'text-line',
  'border-hairline/60': 'border-line', 'bg-hairline/50': 'bg-line/50', 'bg-hairline/60': 'bg-line/60',
  'bg-prius-subtle': 'bg-surface', 'bg-prius-surface': 'bg-surface', 'bg-prius-background': 'bg-canvas',
  'bg-[#EEEEEE]': 'bg-surface', 'bg-[#222222]': 'bg-ink', 'bg-[#111520]': 'bg-ink', 'border-[#E5E5E5]': 'border-line',

  'bg-[#F2CA50]': 'bg-gold', 'border-[#F2CA50]': 'border-gold', 'accent-[#F2CA50]': 'accent-gold',
  'bg-gold-hover': 'bg-gold-400', 'bg-[#E5BF45]': 'bg-gold-400', 'text-gold-hover': 'text-ink',
  'ring-gold/50': 'ring-gold', 'ring-[#F2CA50]/30': 'ring-gold', 'ring-[#F2CA50]/40': 'ring-gold',
  'ring-[#FDE047]/50': 'ring-gold', 'border-t-[#FDE047]': 'border-t-gold', 'accent-[#FDE047]': 'accent-gold',

  'bg-accent-soft': 'bg-gold-100', 'text-accent-ink': 'text-ink', 'text-warning-ink': 'text-ink', 'bg-warning-soft': 'bg-gold-100',
  'bg-info-soft': 'bg-surface', 'text-info-ink': 'text-ink-2',

  'text-prius-success': 'text-success-ink', 'bg-prius-success': 'bg-success',
  'text-prius-error': 'text-danger', 'bg-prius-error': 'bg-danger', 'border-prius-error': 'border-danger',

  'text-display-lg': 'text-page', 'text-headline-lg': 'text-page', 'text-headline-lg-mobile': 'text-page',
  'text-headline-md': 'text-card-title', 'text-headline-sm': 'text-body', 'text-title-md': 'text-body',
  'text-body-lg': 'text-body', 'text-body-md': 'text-body', 'text-sm': 'text-body',
  'text-label-lg': 'text-label', 'text-label-md': 'text-label', 'text-body-sm': 'text-label',
  'text-metric-xl': 'text-stat',

  'rounded': 'rounded-swatch', 'rounded-[32px]': 'rounded-card',
  'backdrop-blur-md': 'backdrop-blur-sm',
}

const QUITAR = /^(shadow-(sm|md|lg|xl|2xl)|shadow-\[.+\]|font-(ui|display|sans|mono))$/

const NEUTROS = 'cyan|sky|violet|purple|gray|slate|neutral|zinc|stone'
const AVISOS = 'amber|orange|yellow'

function mapBase(base, archivo) {
  if (QUITAR.test(base)) return ''
  if (base in EXACTO) return EXACTO[base]

  const heroOscuro = HERO_OSCURO.test(archivo)
  let m

  if (base === 'text-gold' || base === 'text-[#F2CA50]') return DORADO_SOBRE_NEGRO.test(archivo) ? 'text-gold' : 'text-ink'
  if (/^bg-(gold|\[#F2CA50\])\/(\d+|\[[.\d]+\])$/.test(base)) return 'bg-gold-100'
  if (/^border-(gold|\[#F2CA50\])\/\d+$/.test(base)) return 'border-gold-300'

  if ((m = base.match(/^text-black\/(\d+)$/))) return 'text-ink-2'
  if ((m = base.match(/^bg-black\/(\[[.\d]+\])$/))) return 'bg-surface'
  if ((m = base.match(/^bg-black\/(\d+)$/))) return heroOscuro ? 'bg-line' : 'bg-overlay'
  if ((m = base.match(/^text-white\/(\d+)$/))) return `text-on-ink/${m[1]}`
  if ((m = base.match(/^bg-white\/(\d+|\[[.\d]+\])$/))) return heroOscuro ? `bg-on-ink/${m[1]}` : 'bg-surface'
  if ((m = base.match(/^border-white\/(\d+)$/))) return heroOscuro ? `border-on-ink/${m[1]}` : 'border-line'

  if ((m = base.match(/^rounded(-[trblse]{1,2})?-(xl|2xl|3xl|lg|md|sm)$/))) {
    const lado = m[1] || ''
    const destino = { sm: 'swatch', md: 'swatch', lg: 'icon', xl: 'inner', '2xl': 'card', '3xl': 'card' }[m[2]]
    return `rounded${lado}-${destino}`
  }

  const familia = base.match(/^(bg|text|border(?:-[trblxy])?|ring|divide|placeholder|accent)-([a-z]+)-(\d{2,3})(\/.+)?$/)
  if (!familia) return null
  const [, prop, color, shadeTxt, alpha] = familia
  const shade = Number(shadeTxt)
  const tenue = !!alpha || shade <= 100

  if (color === 'green' || color === 'emerald') {
    if (prop === 'text') return 'text-success-ink'
    if (prop === 'bg') return tenue ? 'bg-success-soft' : 'bg-success'
    if (prop.startsWith('border')) return `${prop}-success/30`
    return `${prop}-success`
  }
  if (color === 'red' || color === 'rose') {
    if (prop === 'text') return shade >= 700 ? 'text-danger-ink' : 'text-danger'
    if (prop === 'bg') return tenue ? 'bg-danger-soft' : shade >= 600 ? 'bg-danger-ink' : 'bg-danger'
    if (prop.startsWith('border')) return alpha || shade < 300 ? `${prop}-danger/30` : `${prop}-danger`
    return `${prop}-danger`
  }
  if (new RegExp(`^(${AVISOS})$`).test(color)) {
    if (prop === 'text') return 'text-ink'
    if (prop === 'bg') return tenue || shade <= 200 ? 'bg-gold-100' : 'bg-gold'
    if (prop.startsWith('border')) return `${prop}-gold-300`
    return `${prop}-gold`
  }
  if (new RegExp(`^(${NEUTROS})$`).test(color)) {
    if (prop === 'text') return 'text-ink-2'
    if (prop === 'placeholder') return 'placeholder-ink-2'
    if (prop === 'accent') return 'accent-gold'
    if (prop === 'bg') return tenue || shade <= 300 ? 'bg-surface' : shade >= 700 ? 'bg-ink' : 'bg-ink-2'
    if (prop.startsWith('border')) return `${prop}-line`
    return `${prop}-line`
  }
  return null
}

// Separa variantes (`hover:`, `md:`, `group-hover:`) de la clase, sin cortar
// dentro de corchetes como `[&_svg]:` o `shadow-[0_0_1px_rgba(0,0,0,1)]`.
function partirVariantes(token) {
  let prof = 0
  let corte = -1
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '[') prof++
    else if (token[i] === ']') prof--
    else if (token[i] === ':' && prof === 0) corte = i
  }
  return corte === -1 ? ['', token] : [token.slice(0, corte + 1), token.slice(corte + 1)]
}

const conteo = new Map()

function reescribirLinea(linea, archivo, congelado) {
  const partes = linea.split(/(\s+|['"`])/)
  const salida = []
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i]
    if (!parte || /^(\s+|['"`])$/.test(parte)) { salida.push(parte); continue }
    const [variantes, base] = partirVariantes(parte)
    const destino = congelado ? (FROZEN_MAP[base] ?? null) : mapBase(base, archivo)
    if (destino === null) { salida.push(parte); continue }
    conteo.set(`${base} → ${destino || '(se quita)'}`, (conteo.get(`${base} → ${destino || '(se quita)'}`) || 0) + 1)
    if (destino === '') {
      // Al quitar la clase, también el espacio que la acompaña.
      if (/^\s+$/.test(partes[i + 1] || '')) i++
      else if (/^\s+$/.test(salida[salida.length - 1] || '')) salida.pop()
      continue
    }
    salida.push(variantes + destino)
  }
  return salida.join('')
}

const ES_COMENTARIO = /^\s*(\/\/|\/\*|\*|\{\/\*)/

function procesar(archivo) {
  if (PRINT.test(archivo)) return false
  const congelado = FROZEN.test(archivo)
  const original = readFileSync(archivo, 'utf8')
  const nuevo = original
    .split('\n')
    .map((l) => (ES_COMENTARIO.test(l) ? l : reescribirLinea(l, archivo, congelado)))
    .join('\n')
  if (nuevo === original) return false
  writeFileSync(archivo, nuevo)
  return true
}

function recorrer(dir, acc = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta, acc)
    else if (/\.(jsx|tsx|js|ts)$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

const pedidos = process.argv.slice(2)
const archivos = pedidos.length ? pedidos : recorrer('src')
const cambiados = archivos.filter(procesar)
const lineas = [...conteo.entries()].sort((a, b) => b[1] - a[1])
for (const [regla, n] of lineas) console.log(String(n).padStart(5), regla)
console.log(`\n${cambiados.length} archivos cambiados, ${lineas.reduce((t, [, n]) => t + n, 0)} clases reescritas`)

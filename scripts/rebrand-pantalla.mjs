// Segunda pasada del rebranding, pantalla por pantalla: lleva el marcado viejo
// al lenguaje nuevo (labels, botones, inputs, cards). Después de correrla cada
// pantalla se revisa con capturas.
//   node scripts/rebrand-pantalla.mjs src/pages/crm/Caja.jsx ...
//   ANIDADO=1 node ...   para fichas y modales, donde las cards van sobre blanco
import { readFileSync, writeFileSync } from 'node:fs'

const ANIDADO = !!process.env.ANIDADO
const CHICO = /^(text-xs|text-\[(8|9|10|11|12|13)(\.5)?px\])$/
const GRANDE = /^(text-lg|text-xl|text-2xl|text-3xl|text-4xl)$/
const PESADO = /^font-(bold|black|extrabold|semibold)$/
const TRACKING = /^tracking-/
const RADIO_BOTON = /^rounded-(inner|icon|swatch)$/

function partir(token) {
  const i = token.lastIndexOf(':')
  return i === -1 ? ['', token] : [token.slice(0, i + 1), token.slice(i + 1)]
}

function reescribir(segmento, enBoton) {
  let clases = segmento.split(/\s+/).filter(Boolean)
  const tiene = (c) => clases.includes(c)
  const hay = (re) => clases.some((c) => re.test(partir(c)[1]))

  // Label: "text-[11px] uppercase tracking-widest font-bold" pasa a text-label.
  if (tiene('uppercase') && (hay(TRACKING) || hay(CHICO) || tiene('text-label') || tiene('text-body'))) {
    clases = clases.filter((c) => {
      const b = partir(c)[1]
      return !(b === 'uppercase' || TRACKING.test(b) || PESADO.test(b) || CHICO.test(b) || b === 'text-body')
    })
    if (!tiene('text-label')) clases.unshift('text-label')
  }
  clases = clases.map((c) => {
    const [v, b] = partir(c)
    if (CHICO.test(b)) return `${v}text-label`
    return c
  })

  // Títulos: los tamaños sueltos van a la escala y sin negrita.
  if (hay(GRANDE)) {
    clases = clases
      .filter((c) => !PESADO.test(partir(c)[1]))
      .map((c) => {
        const [v, b] = partir(c)
        if (!GRANDE.test(b)) return c
        return `${v}${b === 'text-lg' || b === 'text-xl' ? 'text-card-title' : 'text-stat'}`
      })
  }
  clases = clases.map((c) => (/^font-(bold|black|extrabold)$/.test(partir(c)[1]) ? c.replace(/font-(bold|black|extrabold)/, 'font-semibold') : c))

  // Botón primario: el dorado pasa a pill negra.
  if (tiene('bg-gold') && clases.some((c) => c === 'hover:bg-gold-400')) {
    clases = clases
      .filter((c) => c !== 'text-ink')
      .map((c) => (c === 'bg-gold' ? 'bg-ink' : c === 'hover:bg-gold-400' ? 'hover:bg-chart-2' : RADIO_BOTON.test(c) ? 'rounded-full' : c))
    clases.push('text-on-ink')
  }

  // Campos: fondo de superficie, sin borde visible, foco dorado.
  const esCampo = (tiene('outline-none') || clases.some((c) => c.startsWith('focus:'))) && (tiene('bg-surface') || tiene('bg-card')) && hay(/^border/)
  if (esCampo) {
    clases = clases
      .filter((c) => !/^(focus:border-|focus:ring|border$|border-line$)/.test(partir(c)[1]) && !/^focus:border/.test(c))
      .map((c) => (c === 'bg-card' ? 'bg-surface' : /^rounded-(icon|swatch)$/.test(c) ? 'rounded-inner' : c === 'min-h-[44px]' ? 'min-h-12' : c))
    clases.push('border', 'border-transparent', 'focus:ring-2', 'focus:ring-gold')
  }

  // Botones que no son filas de lista: pill.
  if (enBoton && !hay(/^(text-left|flex-col|justify-between)$/) && !tiene('w-full')) {
    clases = clases.map((c) => (RADIO_BOTON.test(c) ? 'rounded-full' : c))
  }

  // Cards: sin borde en pantalla; sobre blanco, superficie.
  if (tiene('card-light')) {
    clases = clases.filter((c) => c !== 'card-light' && c !== 'card-light-inner' && !/^(rounded-(card|inner|icon)|border|border-line)$/.test(c))
    clases.unshift(ANIDADO ? 'bg-surface rounded-inner' : 'card-surface')
  }
  clases = clases.filter((c) => c !== 'card-light-inner')
  clases = clases.map((c) => (c === 'popover-light' ? 'surface-pop' : c))
  return clases.join(' ')
}

for (const archivo of process.argv.slice(2)) {
  const original = readFileSync(archivo, 'utf8')
  let enBoton = false
  const salida = original.split('\n').map((linea) => {
    if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(linea)) return linea
    if (/<button\b/.test(linea)) enBoton = true
    const nueva = linea.replace(/(["'`])((?:(?!\1)[^\\$]|\$\{[^}]*\})*)\1/g, (m, q, cuerpo) => {
      if (!/\s/.test(cuerpo) && !/^(text-|font-|uppercase|card-light|popover-light)/.test(cuerpo)) return m
      if (!/\b(text-|font-|uppercase|bg-|rounded|card-light|popover-light|border)/.test(cuerpo)) return m
      if (/[^\w\s\-:/.\[\]%()#&,>$<{}?'"=!|+*]/.test(cuerpo)) return m
      if (cuerpo.includes('${')) {
        const partes = cuerpo.split(/(\$\{[^}]*\})/)
        return q + partes.map((p, i) => (i % 2 ? p : p.replace(/\S+(\s+\S+)*/, (t) => reescribir(t, enBoton)))).join('') + q
      }
      return q + reescribir(cuerpo, enBoton) + q
    })
    if (enBoton && />\s*$/.test(linea) && !/=>\s*$/.test(linea)) enBoton = false
    return nueva
  }).join('\n')
  if (salida !== original) writeFileSync(archivo, salida)
  console.log(salida !== original ? 'cambió' : 'igual ', archivo)
}

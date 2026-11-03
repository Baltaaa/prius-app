// Chequeo de prevención (hotfix 03/11/2026): hace un preflight OPTIONS a cada
// Edge Function con el origin de producción y falla si la función no responde
// o si faltan los headers de CORS. NO invoca lógica ni escribe datos (un
// OPTIONS nunca ejecuta el handler de la función) y no usa credenciales.
//
// Uso: pnpm check:functions
// Opcional: ORIGIN=https://otro.pages.dev pnpm check:functions
//           EXTRA_FUNCTIONS=a,b pnpm check:functions (funciones fuera de supabase/functions)
import { readdirSync, readFileSync, existsSync } from 'node:fs'

const ORIGIN = process.env.ORIGIN || 'https://prius-app.pages.dev'

function leerEnv(clave) {
  if (process.env[clave]) return process.env[clave]
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue
    const m = readFileSync(f, 'utf8').match(new RegExp(`^${clave}=(.*)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}

const base = leerEnv('VITE_SUPABASE_URL')
if (!base) {
  console.error('Falta VITE_SUPABASE_URL (variable de entorno o .env.local).')
  process.exit(2)
}

// La fuente de verdad de "qué funciones existen" es el repo: toda carpeta de
// supabase/functions con index.ts (menos _shared).
const funciones = [
  ...readdirSync('supabase/functions', { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(`supabase/functions/${d.name}/index.ts`))
    .map((d) => d.name),
  ...(process.env.EXTRA_FUNCTIONS ? process.env.EXTRA_FUNCTIONS.split(',').map((s) => s.trim()).filter(Boolean) : []),
]

// Funciones que están en el repo pero a propósito todavía no desplegadas.
const NO_DESPLEGADAS = new Set((process.env.SKIP_FUNCTIONS || 'enviar-qr-reserva').split(',').map((s) => s.trim()))

const REQUERIDOS = ['authorization', 'content-type', 'apikey', 'x-client-info']
let fallas = 0

for (const nombre of funciones) {
  if (NO_DESPLEGADAS.has(nombre)) {
    console.log(`-  ${nombre}: omitida (no desplegada todavía)`)
    continue
  }
  const problemas = []
  try {
    const res = await fetch(`${base}/functions/v1/${nombre}`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type, apikey, x-client-info',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.status !== 200 && res.status !== 204) problemas.push(`respondió ${res.status}`)
    const permitido = res.headers.get('access-control-allow-origin')
    if (permitido !== ORIGIN) problemas.push(`Access-Control-Allow-Origin = ${permitido ?? '(ausente)'}, esperaba ${ORIGIN}`)
    const headers = (res.headers.get('access-control-allow-headers') || '').toLowerCase()
    const faltan = REQUERIDOS.filter((h) => !headers.includes(h))
    if (faltan.length) problemas.push(`Access-Control-Allow-Headers sin: ${faltan.join(', ')}`)
    const metodos = (res.headers.get('access-control-allow-methods') || '').toUpperCase()
    if (!metodos.includes('POST')) problemas.push(`Access-Control-Allow-Methods sin POST (${metodos || 'ausente'})`)
  } catch (err) {
    problemas.push(`no responde (${err.message})`)
  }
  if (problemas.length) {
    fallas++
    console.error(`✗  ${nombre}: ${problemas.join('; ')}`)
  } else {
    console.log(`✓  ${nombre}`)
  }
}

if (fallas) {
  console.error(`\n${fallas} función(es) con problemas de CORS o sin responder (origin ${ORIGIN}).`)
  process.exit(1)
}
console.log(`\nTodas las Edge Functions responden el preflight para ${ORIGIN}.`)

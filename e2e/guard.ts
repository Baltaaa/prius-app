import { mkdirSync, appendFileSync } from 'node:fs'
import type { Page, Route } from '@playwright/test'

// Guard de requests para correr Playwright contra producción sin escribir
// nada: lista blanca, todo lo no listado se corta y el test falla. Se activa
// solo con playwright.rebrand.config.ts (RB_GUARD=1), ver fixtures.ts.
//
// Las RPC son POST aunque lean, por eso van por nombre. Volatilidad verificada
// en pg_proc: cuatro STABLE; historial_entidad está declarada VOLATILE, pero
// su definición no tiene INSERT/UPDATE/DELETE.
const RPC_LECTURA = new Set([
  'resumen_caja',
  'cotizar',
  'disponibilidad_publica',
  'buscar_unidad_vecina',
  'historial_entidad',
])

// Escrituras que la app dispara sola al navegar. Se cortan con una respuesta
// falsa exitosa: si fallaran, ensuciarían la UI con errores que no son reales.
const RPC_SILENCIOSA = new Set(['fn_recalcular_estados_unidades', 'fn_registrar_evento_auth'])
const TABLA_SILENCIOSA = new Set(['vistas_recientes', 'preferencias_usuario'])
const FUNCION_SILENCIOSA = new Set(['tipo-cambio'])

export type Veredicto = 'permitir' | 'simular' | 'bloquear'

export function clasificar(metodo: string, pathname: string): Veredicto {
  const lectura = metodo === 'GET' || metodo === 'HEAD'
  if (metodo === 'OPTIONS') return 'permitir'

  if (pathname.startsWith('/auth/v1/')) {
    const ruta = pathname.slice('/auth/v1/'.length)
    if (ruta === 'token' && metodo === 'POST') return 'permitir'
    if (ruta === 'user' && lectura) return 'permitir'
    if (ruta === 'logout') return 'simular'
    return 'bloquear'
  }

  if (pathname.startsWith('/rest/v1/rpc/')) {
    const nombre = pathname.slice('/rest/v1/rpc/'.length)
    if (RPC_LECTURA.has(nombre)) return 'permitir'
    return RPC_SILENCIOSA.has(nombre) ? 'simular' : 'bloquear'
  }

  if (pathname.startsWith('/rest/v1/')) {
    if (lectura) return 'permitir'
    return TABLA_SILENCIOSA.has(pathname.slice('/rest/v1/'.length)) ? 'simular' : 'bloquear'
  }

  if (pathname.startsWith('/functions/v1/')) {
    const nombre = pathname.slice('/functions/v1/'.length)
    if (nombre === 'clima-playa' && lectura) return 'permitir'
    return FUNCION_SILENCIOSA.has(nombre) ? 'simular' : 'bloquear'
  }

  return 'bloquear'
}

/** Instala el guard y devuelve la lista de intentos bloqueados de la corrida. */
export async function instalarGuard(page: Page, testTitulo: string): Promise<string[]> {
  const host = new URL(process.env.VITE_SUPABASE_URL as string).host
  const bloqueados: string[] = []
  mkdirSync('test-results', { recursive: true })

  await page.route((url) => url.host === host, async (route: Route) => {
    const req = route.request()
    const { pathname } = new URL(req.url())
    const veredicto = clasificar(req.method(), pathname)
    appendFileSync('test-results/guard-requests.log', `${veredicto} ${req.method()} ${pathname} [${testTitulo}]\n`)

    if (veredicto === 'permitir') return route.continue()
    if (veredicto === 'simular') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    bloqueados.push(`${req.method()} ${pathname}`)
    return route.abort('blockedbyclient')
  })
  return bloqueados
}

import { test, login } from './fixtures'
import type { Page } from '@playwright/test'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { auditarLayout } from './responsive-checks'

// Fase 5: abre cada overlay con clicks reales y lo captura. Nunca confirma:
// el guard corta cualquier escritura, y ConfirmarSuperadminModal no recibe
// contraseña (5 intentos fallidos bloquean 15 minutos).
const OUT = 'design/rebrand-shots/overlays'
const TODOS = '360x640,390x844,430x932,768x1024,834x1194,1024x768,1180x820,1280x800,1366x768,1440x900,1920x1080'
const ANCHOS = (process.env.ANCHOS || '390x844,1440x900').split(',').map((a) => a.split('x').map(Number))
const LOG = process.env.LOG || `${OUT}/hallazgos.log`

async function ir(page: Page, ruta: string) {
  await page.goto(ruta)
  await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1200)
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 20_000 }).catch(() => {})
  await page.waitForTimeout(500)
}

type Paso = { nombre: string; solo?: 'desktop' | 'mobile'; correr: (p: Page, mobile: boolean) => Promise<void> }

const abrirFichaReserva = async (p: Page, mobile: boolean) => {
  await ir(p, '/app/reservas')
  if (mobile) await p.getByText('Ana Lescano').first().click()
  else await p.locator('tbody tr').first().click()
  await p.waitForTimeout(600)
}
const abrirFichaCliente = async (p: Page) => {
  await ir(p, '/app/clientes')
  await p.getByText('Adriana Aguero').first().click()
  await p.waitForTimeout(800)
}

const PASOS: Paso[] = [
  { nombre: 'nueva-reserva', correr: async (p, m) => {
    await ir(p, '/app/home')
    if (m) await p.getByRole('button', { name: 'Reserva', exact: true }).click()
    else await p.getByRole('button', { name: 'Nueva reserva' }).click()
    await p.waitForTimeout(500)
  } },
  { nombre: 'date-picker', correr: async (p) => {
    await ir(p, '/app/reservas')
    await p.getByPlaceholder('Llegada desde').click()
    await p.waitForTimeout(400)
  } },
  { nombre: 'perfil-menu', solo: 'desktop', correr: async (p) => { await ir(p, '/app/home'); await p.getByLabel('Menú de usuario').hover(); await p.waitForTimeout(400) } },
  { nombre: 'notificaciones', correr: async (p, m) => { await ir(p, '/app/home'); if (m) await p.getByLabel('Notificaciones').click(); else await p.getByLabel('Notificaciones').hover(); await p.waitForTimeout(500) } },
  { nombre: 'busqueda', correr: async (p, m) => {
    await ir(p, '/app/home')
    if (m) await p.getByLabel('Buscar', { exact: true }).click()
    await p.getByPlaceholder(/Búsqueda inteligente|^Buscar$/).last().fill('agu')
    await p.waitForTimeout(600)
  } },
  { nombre: 'mas-sheet', solo: 'mobile', correr: async (p) => { await ir(p, '/app/home'); await p.getByRole('button', { name: 'Más', exact: true }).click(); await p.waitForTimeout(400) } },
  { nombre: 'clima-panel', correr: async (p) => { await ir(p, '/app/home'); await p.getByText('Ver pronóstico').click(); await p.waitForTimeout(600) } },
  { nombre: 'plano-unidad', correr: async (p) => {
    await ir(p, '/app/plano?fecha=2027-01-01')
    await p.locator('[style*="touch-action"] button').nth(40).click({ force: true })
    await p.waitForTimeout(600)
  } },
  { nombre: 'plano-fullscreen', solo: 'desktop', correr: async (p) => { await ir(p, '/app/plano'); await p.getByTitle('Ver en pantalla completa').click(); await p.waitForTimeout(600) } },
  { nombre: 'reservas-filtros', correr: async (p) => { await ir(p, '/app/reservas'); await p.getByRole('button', { name: /Filtros/ }).click(); await p.waitForTimeout(300) } },
  { nombre: 'reservas-ficha', correr: abrirFichaReserva },
  { nombre: 'registrar-pago', correr: async (p) => {
    await abrirFichaCliente(p)
    await p.getByRole('button', { name: /Registrar pago/i }).first().click()
    await p.waitForTimeout(600)
  } },
  { nombre: 'select-medio-pago', correr: async (p) => {
    await abrirFichaCliente(p)
    await p.getByRole('button', { name: /Registrar pago/i }).first().click()
    await p.waitForTimeout(500)
    await p.getByRole('button', { name: /Efectivo/ }).first().click()
    await p.waitForTimeout(400)
  } },
  { nombre: 'clientes-ficha', correr: async (p) => { await abrirFichaCliente(p) } },
  { nombre: 'nuevo-cliente', correr: async (p) => { await ir(p, '/app/clientes'); await p.getByRole('button', { name: /^Nuevo/ }).click(); await p.waitForTimeout(500) } },
  { nombre: 'confirmar-superadmin', correr: async (p) => {
    await abrirFichaCliente(p)
    await p.locator('button:has(svg.lucide-trash-2):visible').first().click()
    await p.waitForTimeout(500)
  } },
  { nombre: 'caja-cierre', correr: async (p) => {
    await ir(p, '/app/caja?fecha=2026-10-30')
    await p.locator('button:visible', { hasText: /Cerrar caja/i }).first().click()
    await p.waitForTimeout(600)
  } },
  { nombre: 'caja-gasto', correr: async (p) => {
    await ir(p, '/app/caja?fecha=2026-10-30')
    await p.getByRole('button', { name: /Egreso|Gasto/ }).first().click()
    await p.waitForTimeout(600)
  } },
  { nombre: 'toast-error', correr: async (p) => {
    await p.route(/\/rest\/v1\/leads/, (r) => (r.request().method() === 'GET' ? r.fallback() : r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"simulado"}' })))
    await ir(p, '/app/leads')
    await p.getByRole('button', { name: 'Descartar' }).first().click({ force: true })
    await p.waitForTimeout(500)
    await p.getByRole('button', { name: /Confirmar/ }).click({ timeout: 1500 }).catch(() => {})
    await p.waitForTimeout(600)
  } },
  { nombre: 'inactividad', correr: async (p) => {
    await p.clock.install()
    await ir(p, '/app/home')
    await p.evaluate(() => localStorage.setItem('prius_last_activity', String(Date.now() - 14 * 60 * 1000)))
    await p.clock.fastForward(20_000)
    await p.waitForTimeout(800)
  } },
]

// `ANCHOS=todos` corre los 11 anchos del checklist. Cada overlay se captura y
// pasa por los chequeos de layout (cero desborde dentro del modal o sheet).
test('overlays', async ({ page }) => {
  test.setTimeout(3_000_000)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(LOG, '')
  const anchos = process.env.ANCHOS === 'todos' ? TODOS.split(',').map((a) => a.split('x').map(Number)) : ANCHOS
  const solo = process.env.PASOS?.split(',')
  page.setDefaultTimeout(12_000)
  await page.setViewportSize({ width: anchos[0][0], height: anchos[0][1] })
  await login(page)
  for (const [w, h] of anchos) {
    const mobile = w < 768
    await page.setViewportSize({ width: w, height: h })
    // El paso de inactividad deja la sesión en pie de guerra (reloj falso y
    // última actividad vieja): cada ancho arranca con sesión y actividad frescas.
    await page.evaluate(() => localStorage.setItem('prius_last_activity', String(Date.now()))).catch(() => {})
    await page.goto('/app/home')
    await page.waitForTimeout(1500)
    if (!/\/app\//.test(page.url())) await login(page)
    for (const paso of PASOS) {
      if (paso.solo === 'desktop' && mobile) continue
      if (paso.solo === 'mobile' && !mobile) continue
      if (solo && !solo.includes(paso.nombre)) continue
      try {
        await paso.correr(page, mobile)
        await page.waitForTimeout(450) // la animación de apertura (scale .96→1, 200ms) tiene que terminar antes de medir
        if (!process.env.SIN_CAPTURAS) await page.screenshot({ path: `${OUT}/${paso.nombre}-${w}.png` })
        for (const x of await auditarLayout(page, { mobile, sinNav: true })) appendFileSync(LOG, `${paso.nombre} ${w}x${h} [${x.regla}] ${x.detalle}\n`)
        console.log('OK', w, paso.nombre, page.url().includes('/login') ? 'SESION-CERRADA' : '')
      } catch (e) {
        appendFileSync(LOG, `${paso.nombre} ${w}x${h} [falla-paso] ${String(e).split('\n')[0].slice(0, 140)}\n`)
      }
    }
  }
})

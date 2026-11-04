import { test, login } from './fixtures'
import { auditarPadding, esperarCarga } from './responsive-checks'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'

// Bloque 5: revisión de padding en toda la app (solo lectura, ver e2e/guard.ts).
const ANCHOS = (process.env.ANCHOS || '390x844,768x1024,1024x768,1280x800,1440x900').split(',').map((a) => a.split('x').map(Number))
const RUTAS = (process.env.RUTAS || 'home,plano,recepcion,reservas,clientes,caja,caja~fecha=2026-10-30,reportes,leads,historial,comprobantes,perfil,cabinas-lockers,notificaciones').split(',')
const OUT = 'design/rebrand-shots/padding'
const LOG = process.env.LOG || `${OUT}/hallazgos.log`

test('padding: rutas y fichas', async ({ page }) => {
  test.setTimeout(3_000_000)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(LOG, '')
  await login(page)
  const registrar = async (nombre: string, w: number, h: number) => {
    for (const x of await auditarPadding(page)) appendFileSync(LOG, `${nombre} ${w}x${h} [${x.regla}] ${x.detalle}\n`)
  }
  for (const ruta of RUTAS) {
    for (const [w, h] of ANCHOS) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`/app/${ruta.replaceAll('~', '?')}`)
      await esperarCarga(page)
      await registrar(ruta, w, h)
      if (ruta === 'clientes') {
        await page.getByText('Adriana Aguero').first().click(); await page.waitForTimeout(900)
        await registrar('clientes+ficha', w, h)
      }
      if (ruta === 'reservas') {
        if (w < 768) await page.getByText('Ana Lescano').first().click()
        else await page.locator('tbody tr').first().click()
        await page.waitForTimeout(900)
        await registrar('reservas+ficha', w, h)
      }
      if (ruta === 'plano' && w >= 768) {
        await page.locator('[style*="touch-action"] button').nth(40).click({ force: true }); await page.waitForTimeout(800)
        await registrar('plano+ficha', w, h)
      }
    }
  }
})

import { test, login } from './fixtures'
import { auditarLayout, esperarCarga } from './responsive-checks'
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'

// Paso 5: cada ruta a los 11 anchos con los chequeos de responsive-checks.ts y
// captura en design/rebrand-shots/responsive/. Solo lee (ver e2e/guard.ts).
// RUTAS=home,caja ANCHOS=360x640,... acotan la corrida.
const TODOS = '360x640,390x844,430x932,768x1024,834x1194,1024x768,1180x820,1280x800,1366x768,1440x900,1920x1080'
const ANCHOS = (process.env.ANCHOS || TODOS).split(',').map((a) => a.split('x').map(Number))
const RUTAS = (process.env.RUTAS || 'home,plano,recepcion,reservas,clientes,caja,reportes,leads,historial,comprobantes,perfil,cabinas-lockers,notificaciones,ocupacion,no-existe').split(',')
const OUT = 'design/rebrand-shots/responsive'
const LOG = process.env.LOG || `${OUT}/hallazgos.log`

test('responsive: rutas × anchos', async ({ page }) => {
  test.setTimeout(3_000_000)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(LOG, '')
  await login(page)
  for (const ruta of RUTAS) {
    for (const [w, h] of ANCHOS) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`/app/${ruta.replaceAll('~', '?')}`)
      await esperarCarga(page)
      const nombre = `${ruta.replace(/[^a-z0-9-]/gi, '_')}-${w}`
      const hallazgos = await auditarLayout(page, { mobile: w < 768 })
      if (!process.env.SIN_CAPTURAS) await page.screenshot({ path: `${OUT}/${nombre}.png` })
      for (const x of hallazgos) appendFileSync(LOG, `${ruta} ${w}x${h} [${x.regla}] ${x.detalle}\n`)
    }
  }
})

import { test, login } from './fixtures'
import { auditarLayout } from './responsive-checks'
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'

// Pantallas fuera del shell: Login, recuperar contraseña y Cambiar contraseña,
// en los 11 anchos del checklist. Solo lee (ver e2e/guard.ts): nunca envía los
// formularios.
const TODOS = '360x640,390x844,430x932,768x1024,834x1194,1024x768,1180x820,1280x800,1366x768,1440x900,1920x1080'
const ANCHOS = (process.env.ANCHOS || TODOS).split(',').map((a) => a.split('x').map(Number))
const OUT = 'design/rebrand-shots/responsive'
const LOG = process.env.LOG || `${OUT}/hallazgos-publicas.log`

test('pantallas públicas', async ({ page }) => {
  test.setTimeout(900_000)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(LOG, '')
  const captura = async (nombre: string, w: number, h: number) => {
    await page.waitForTimeout(1200)
    for (const x of await auditarLayout(page, { mobile: w < 768, sinNav: true })) appendFileSync(LOG, `${nombre} ${w}x${h} [${x.regla}] ${x.detalle}\n`)
    await page.screenshot({ path: `${OUT}/${nombre}-${w}.png` })
  }
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    for (const ruta of ['login', 'recuperar']) {
      await page.goto(`/${ruta}`)
      await captura(ruta, w, h)
    }
  }
  await login(page)
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    for (const ruta of ['cambiar-contrasena', 'restablecer-contrasena']) {
      await page.goto(`/${ruta}`)
      await captura(ruta, w, h)
    }
  }
})

import { test, expect, login } from './fixtures'
import type { Page } from '@playwright/test'

// Todo botón visible tiene que recibir el click: detecta controles tapados por
// otro elemento, algo que una captura no muestra. Solo mira el punto central,
// no hace click en nada.
const ANCHOS = [[390, 844], [768, 1024], [1024, 768], [1280, 800], [1366, 768], [1397, 834], [1440, 900]]
const RUTAS = (process.env.RUTAS || 'home,plano,reservas,clientes,caja,caja?fecha=2026-10-30,reportes,leads,historial,comprobantes,perfil,recepcion,cabinas-lockers,notificaciones').split(',')

async function tapados(page: Page) {
  return page.evaluate(() => {
    const out: string[] = []
    // Con una ficha o un overlay abierto, lo de atrás queda tapado a propósito.
    const overlays = document.querySelectorAll<HTMLElement>('.fixed.inset-0')
    const raiz: ParentNode = overlays.length ? overlays[overlays.length - 1] : document
    for (const b of raiz.querySelectorAll<HTMLElement>('button, a[href]')) {
      const r = b.getBoundingClientRect()
      const estilo = getComputedStyle(b)
      if (r.width < 4 || r.height < 4 || estilo.visibility === 'hidden' || estilo.pointerEvents === 'none') continue
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue
      // Fila recortada por una caja con scroll propio: se llega scrolleando.
      let recortado = false
      for (let n = b.parentElement; n; n = n.parentElement) {
        if (getComputedStyle(n).overflowY === 'visible') continue
        const caja = n.getBoundingClientRect()
        if (cy <= caja.top + 1 || cy >= caja.bottom - 1 || cx <= caja.left + 1 || cx >= caja.right - 1) recortado = true
      }
      if (recortado) continue
      const e = document.elementFromPoint(cx, cy)
      if (!e || b.contains(e) || e.contains(b)) continue
      if (e.closest('nav, aside, header')) continue // el contenido scrollea por detrás de la navegación fija
      if (b.closest('[style*="touch-action"]')) continue // celdas del mapa
      out.push(`${(b.textContent || b.title || b.getAttribute('aria-label') || '?').trim().slice(0, 26)} ⟵ ${e.tagName}.${String(e.className).slice(0, 50)}`)
    }
    return [...new Set(out)]
  })
}

test('botones que reciben el click', async ({ page }) => {
  test.setTimeout(560_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  const problemas: string[] = []
  for (const [w, h] of ANCHOS) {
    await page.setViewportSize({ width: w, height: h })
    for (const ruta of RUTAS) {
      await page.goto(`/app/${ruta}`)
      await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 })
      await page.waitForTimeout(1500)
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(500)
      if (ruta === 'clientes') { await page.getByText('Adriana Aguero').first().click(); await page.waitForTimeout(900) }
      if (ruta === 'reservas') { await page.getByText('Ana Lescano').first().click(); await page.waitForTimeout(900) }
      for (const t of await tapados(page)) { problemas.push(`${w} ${ruta}: ${t}`); console.log('TAPADO', w, ruta, t) }
    }
  }
  expect(problemas).toEqual([])
})

import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Historial -> destino de cada tipo de evento (lib/destinoEvento.js). Solo lectura:
// abre filas reales de cada familia de evento, aprieta el botón de ir al registro
// y comprueba que la ficha queda abierta o que avisa "Este registro ya no existe".
// Nunca una pantalla vacía.
const BUSQUEDAS = ['cliente', 'reserva', 'pago', 'comprobante', 'cosocio', 'lead', 'caja', 'gasto', 'unidad', 'sesión']

for (const [nombre, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]] as [string, number, number][]) {
  test(`historial ${nombre}: cada evento abre su ficha o avisa que ya no existe`, async ({ page }) => {
    test.setTimeout(600_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    const visitados: string[] = []

    for (const q of BUSQUEDAS) {
      for (const idx of [0, 1]) {
        await page.goto(`/app/historial?hDesde=2026-08-01&hq=${encodeURIComponent(q)}`)
        await esperarCarga(page)
        const filas = page.locator('#app-main-scroll button.hover-row')
        if ((await filas.count()) <= idx) continue
        const fila = filas.nth(idx)
        const etiqueta = ((await fila.innerText()) || '').split('\n').filter(Boolean).slice(0, 3).join(' | ')
        await fila.click()

        const ir = page.getByRole('button', { name: /^(Ver ficha de|Abrir registro)/ }).first()
        if (!(await ir.isVisible().catch(() => false))) {
          visitados.push(`${q}#${idx} sin destino: ${etiqueta}`)
          continue
        }
        await ir.click()
        // Si los datos del CRM aún cargan, la app avisa y no navega: se reintenta.
        for (let i = 0; i < 6; i++) {
          await page.waitForTimeout(1200)
          if (new URL(page.url()).pathname !== '/app/historial') break
          if (await page.getByText('Este registro ya no existe').isVisible().catch(() => false)) break
          const avisos = await page.evaluate(() => (document.body.innerText.match(/Cargando datos[^\n]*|No se encontr[^\n]*|ya no existe/g) || []).join(' / '))
          if (avisos) console.log(`${q}#${idx} iter ${i}: aviso "${avisos}" url=${page.url()}`)
          if (await ir.isVisible().catch(() => false)) await ir.click()
        }

        const url = new URL(page.url())
        if (url.pathname === '/app/historial') {
          // Se quedó acá: tiene que haber avisado.
          await expect(page.getByText('Este registro ya no existe'), `${q}#${idx}: ${etiqueta}`).toBeVisible()
          visitados.push(`${q}#${idx} inexistente: ${etiqueta}`)
          continue
        }
        await esperarCarga(page)
        await expect(page.getByText('No se encontró el registro'), `${q}#${idx}: no se encontró (${url.pathname})`).toHaveCount(0)
        if (url.pathname === '/app/clientes') {
          await expect(page.locator('li[data-cliente-id].bg-gold-50'), `${q}#${idx}: ficha de cliente abierta`).toHaveCount(1)
          await expect(page.getByText('Elegí un cliente para ver la ficha')).toHaveCount(0)
        } else if (url.pathname === '/app/reservas') {
          await expect(page.getByText('Elegí una reserva para ver el detalle'), `${q}#${idx}: Reservas vacía`).toHaveCount(0)
        }
        visitados.push(`${q}#${idx} -> ${url.pathname}: ${etiqueta}`)
      }
    }
    console.log(visitados.join('\n'))
    expect(visitados.length).toBeGreaterThan(5)
  })
}

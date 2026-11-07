import { test, expect, login } from './fixtures'
import type { Page } from '@playwright/test'
import { esperarCarga } from './responsive-checks'

// Superficie grafito: solo el botón "Nueva reserva" del topbar y la card de Caja diaria.
// Solo lectura. "Sin iniciar" y "abierta" se fuerzan interceptando el GET de la caja de hoy.
const ANCHOS: [string, number, number][] = [['desktop', 1440, 900], ['mobile', 390, 844]]
const PARADAS = [[0x2a, 0x2a, 0x28, 0], [0x3a, 0x39, 0x36, 0.55], [0x55, 0x52, 0x4c, 1]]
const OUT = process.env.GRAFITO_OUT || ''

async function simularCaja(page: Page, estado: 'abierta' | 'sin') {
  await page.route(/\/rest\/v1\/caja_diaria\?.*fecha=eq\./, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const objeto = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object')
    if (estado === 'sin') {
      return objeto
        ? route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }) })
        : route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    const fila = { id: '00000000-0000-0000-0000-000000000001', fecha: new Date().toISOString().slice(0, 10), estado: 'abierta', total_cobros: 1234567, efectivo_inicial: 0 }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(objeto ? fila : [fila]) })
  })
}

// Contraste del texto (blanco al `alfa`) sobre el degradé en el punto (x, y) de la card.
function contraste(caja: { w: number; h: number }, x: number, y: number, alfa: number) {
  const g = (Math.abs(caja.w * Math.sin(Math.PI * 0.75)) + Math.abs(caja.h * Math.cos(Math.PI * 0.75)))
  const t = Math.min(1, Math.max(0, 0.5 + ((x - caja.w / 2) * Math.SQRT1_2 + (y - caja.h / 2) * Math.SQRT1_2) / g))
  const i = t <= 0.55 ? 0 : 1
  const [a, b] = [PARADAS[i], PARADAS[i + 1]]
  const k = (t - a[3]) / (b[3] - a[3])
  const fondo = [0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * k)
  const texto = fondo.map((f) => 255 * alfa + f * (1 - alfa))
  const lum = (rgb: number[]) => { const [r, gg, bb] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * gg + 0.0722 * bb }
  const [l1, l2] = [lum(texto), lum(fondo)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

for (const [nombre, w, h] of ANCHOS) {
  for (const estado of ['abierta', 'sin'] as const) {
    test(`grafito ${nombre} · caja ${estado}`, async ({ page }) => {
      test.setTimeout(240_000)
      await login(page)
      await page.setViewportSize({ width: w, height: h })
      await simularCaja(page, estado)
      await page.goto('/app/home')
      await esperarCarga(page)
      await page.waitForTimeout(1500)

      const card = page.locator('section:visible:has-text("Caja diaria")').first()
      await expect(card).toBeVisible()
      const est = await card.evaluate((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { img: s.backgroundImage, sombra: s.boxShadow, radio: s.borderTopLeftRadius, color: s.color, w: r.width, h: r.height, olas: e.querySelectorAll('svg[viewBox="0 0 450 200"]').length } })
      expect(est.img).toContain('linear-gradient(135deg')
      expect(est.img).toContain('rgb(42, 42, 40)')
      expect(est.img).toContain('rgb(85, 82, 76)')
      expect(est.sombra).toContain('rgba(255, 255, 255, 0.08)')
      expect(est.sombra).toContain('rgba(0, 0, 0, 0.35)')
      expect(est.radio).toBe('24px')
      expect(est.color).toBe('rgb(255, 255, 255)')
      expect(est.olas, 'sin patrón de olas').toBe(0)

      if (estado === 'abierta') {
        const sec = card.getByText('Abierta · total del día')
        await expect(sec).toBeVisible()
        const r = await sec.evaluate((e, c) => { const rg = document.createRange(); rg.selectNodeContents(e); const b = rg.getBoundingClientRect(); const cb = c.getBoundingClientRect(); return { x: b.right - cb.left, y: b.bottom - cb.top, color: getComputedStyle(e).color } }, await card.elementHandle())
        expect(r.color).toMatch(/rgba\(255, 255, 255, 0\.6\)/)
        const cr = contraste(est, r.x, r.y, 0.6)
        console.log(`${nombre} contraste secundario ${cr.toFixed(2)}`)
        expect(cr, 'AA texto secundario').toBeGreaterThanOrEqual(4.5)
        // modo privacidad: el monto sale oculto y se restaura
        const monto = card.locator('.text-amount')
        await expect(monto).toContainText('1.234.567')
        await card.getByRole('button', { name: 'Ocultar montos' }).click()
        await expect(monto).toContainText('••••')
        if (OUT) await card.screenshot({ path: `${OUT}/${nombre}-caja-oculta.png` })
        await card.getByRole('button', { name: 'Mostrar montos' }).click()
        await expect(monto).toContainText('1.234.567')
      } else {
        await expect(card.getByText('Sin iniciar')).toBeVisible()
        const abrir = card.getByRole('button', { name: 'Abrir' })
        expect(await abrir.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(242, 202, 80)')
        expect(await card.evaluate((e) => e.querySelectorAll('[class*="bg-danger"],[class*="bg-gold-50"]').length), 'sin aviso amarillo').toBe(0)
      }
      if (OUT) await card.screenshot({ path: `${OUT}/${nombre}-caja-${estado}.png` })

      if (nombre === 'desktop' && estado === 'abierta') {
        const boton = page.getByRole('button', { name: 'Nueva reserva' }).first()
        await expect(boton).toBeVisible()
        const b = await boton.evaluate((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { img: s.backgroundImage, sombra: s.boxShadow, color: s.color, h: r.height, radio: s.borderTopLeftRadius, bg: s.backgroundColor } })
        expect(b.img).toContain('linear-gradient(135deg')
        expect(b.img).toContain('rgb(58, 57, 54)')
        expect(b.sombra).toContain('rgba(255, 255, 255, 0.08)')
        expect(b.color).toBe('rgb(255, 255, 255)')
        expect(b.h).toBe(44)
        expect(parseFloat(b.radio)).toBeGreaterThan(20)
        // hover: la capa de aclarado pasa a visible en 200ms
        const capa = () => boton.evaluate((e) => getComputedStyle(e, '::before').opacity)
        await page.mouse.move(0, 0)
        expect(await capa()).toBe('0')
        await boton.hover()
        await page.waitForTimeout(350)
        expect(await capa()).toBe('1')
        // active: scale .98
        await page.mouse.down()
        await page.waitForTimeout(350)
        expect(await boton.evaluate((e) => getComputedStyle(e).transform)).toBe('matrix(0.98, 0, 0, 0.98, 0, 0)')
        await page.mouse.move(0, 0)
        await page.mouse.up()
        await page.waitForTimeout(300)
        if (OUT) await page.screenshot({ path: `${OUT}/${nombre}-home.png` })
        // los demás botones primarios siguen en negro plano
        await page.goto('/app/clientes')
        await esperarCarga(page)
        const planos = await page.evaluate(() => [...document.querySelectorAll('.btn-primary')].filter((e) => (e as HTMLElement).offsetParent).map((e) => getComputedStyle(e).backgroundImage))
        for (const p of planos) expect(p).toBe('none')
      }
      if (nombre === 'mobile' && estado === 'abierta' && OUT) await page.screenshot({ path: `${OUT}/${nombre}-home.png` })
    })
  }
}

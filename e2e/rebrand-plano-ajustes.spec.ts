import { test, expect, login } from './fixtures'
import { esperarCarga } from './responsive-checks'

// Ajustes del Plano (06/11/2026): zonas Acceso/Recreación, tiles con pill, pantalla completa
// (logo + X en desktop, modal sin bordes en mobile) y mar del modo cliente. Solo lectura.
const ANCHOS: [string, number, number][] = [['desktop', 1440, 900], ['mobile', 390, 844]]

const rect = (page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector(s) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }
}, sel)

for (const [nombre, w, h] of ANCHOS) {
  test(`plano ${nombre}: zonas Acceso/Recreación y tiles con pill (vista normal)`, async ({ page }) => {
    test.setTimeout(240_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/plano')
    await esperarCarga(page)

    // zonas: mismo tratamiento que la pileta (radio, 1px, alto), dorado 50 + borde dorado 300
    const cajas = await page.evaluate(() => {
      const caja = (txt: string) => {
        const span = [...document.querySelectorAll('[data-plano-rotable] span.plano-contra')].find((e) => e.textContent?.trim() === txt)!
        const el = span.closest('div[class*="rounded-lg"]') as HTMLElement
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const sp = getComputedStyle(span)
        return { bg: cs.backgroundColor, borde: cs.borderTopColor, ancho: cs.borderTopWidth, radio: cs.borderTopLeftRadius, radioDer: cs.borderBottomRightRadius, x: r.x, r: r.right, y: r.y, b: r.bottom, h: r.height, tracking: sp.letterSpacing, tam: sp.fontSize, mayus: sp.textTransform }
      }
      const fila = document.querySelector('[data-plano-rotable]')!.getBoundingClientRect()
      return { rec: caja('Recreación'), acc: caja('Acceso'), pil: caja('Pileta'), fila: { x: fila.x, r: fila.right } }
    })
    for (const z of [cajas.rec, cajas.acc]) {
      expect(z.bg).toBe('rgb(254, 251, 243)')
      expect(z.borde).toBe('rgb(247, 223, 150)')
      expect(z.ancho).toBe('1px')
      expect(z.radio).toBe(cajas.pil.radio)
      expect(z.radioDer).toBe(cajas.pil.radioDer)
      expect(Math.abs(z.h - cajas.pil.h)).toBeLessThanOrEqual(1)
      expect(Math.abs(z.y - cajas.pil.y)).toBeLessThanOrEqual(1) // alineadas con la pileta
      expect(z.tracking).toBe(cajas.pil.tracking)
      expect(z.mayus).toBe('uppercase')
    }
    // simétricas: Recreación y Pileta miden lo mismo y el aire a los costados es igual
    expect(Math.abs((cajas.rec.r - cajas.rec.x) - (cajas.pil.r - cajas.pil.x))).toBeLessThanOrEqual(1)
    expect(Math.abs((cajas.rec.x - cajas.fila.x) - (cajas.fila.r - cajas.pil.r))).toBeLessThanOrEqual(1)

    // tiles: número igual, valor secundario en pill negra de 13px con padding 2x8
    const tiles = await page.evaluate(() => [...document.querySelectorAll('[role="radiogroup"][aria-label="Filtrar el plano por estado"] [role="radio"]')].map((t) => {
      const tr = t.getBoundingClientRect()
      const pill = t.querySelector('[data-tile-pill]') as HTMLElement | null
      const pc = pill && getComputedStyle(pill)
      const pr = pill?.getBoundingClientRect()
      const num = t.querySelector('span.tabular-nums') as HTMLElement
      return {
        label: (t.querySelector('span') as HTMLElement).textContent,
        num: num.textContent,
        pill: pill?.textContent ?? null,
        fs: pc?.fontSize, pad: pc && `${pc.paddingTop} ${pc.paddingRight} ${pc.paddingBottom} ${pc.paddingLeft}`,
        bg: pc?.backgroundColor, color: pc?.color, radio: pc?.borderTopLeftRadius,
        dentro: pr ? pr.left >= tr.left - 1 && pr.right <= tr.right + 1 && pr.top >= tr.top - 1 && pr.bottom <= tr.bottom + 1 : true,
        activo: t.getAttribute('aria-checked'),
      }
    }))
    console.log(`${nombre}: ${JSON.stringify(tiles.map((t) => [t.label, t.num, t.pill]))}`)
    expect(tiles.length).toBe(4)
    expect(tiles[0].pill, 'Todas no lleva pill').toBeNull()
    expect(tiles[1].pill).toMatch(/^\d+%$/)
    expect(tiles[2].pill).toMatch(/^\d+%$/)
    for (const t of tiles.filter((x) => x.pill)) {
      expect(t.fs).toBe('13px')
      expect(t.pad).toBe('2px 8px 2px 8px')
      expect(t.bg).toMatch(/^rgb\((\d+), (\d+), (\d+)\)$/)
      const [r, g, b] = (t.bg as string).match(/\d+/g)!.map(Number)
      expect(r + g + b, 'fondo oscuro').toBeLessThan(150)
      expect(t.color).toBe('rgb(255, 255, 255)')
      expect(t.dentro, `pill dentro del tile ${t.label}`).toBe(true)
    }
    // activo: Todas lo está de entrada; al activar Ocupadas la pill sigue negra con texto blanco
    await page.getByRole('radio', { name: /Ocupadas/ }).first().click()
    const act = await page.evaluate(() => {
      const t = document.querySelector('[role="radio"][aria-checked="true"]')!
      const p = t.querySelector('[data-tile-pill]') as HTMLElement
      const cs = getComputedStyle(p)
      return { tile: getComputedStyle(t).backgroundColor, pill: cs.backgroundColor, color: cs.color }
    })
    expect(act.color).toBe('rgb(255, 255, 255)')
    expect(act.pill).not.toBe(act.tile)

    // el mar NO está en la vista normal; el viejo rótulo sí
    await expect(page.locator('[data-plano-mar]')).toHaveCount(0)
    await expect(page.locator('[data-plano-rotable]').getByText('Océano Atlántico')).toHaveCount(1)
  })

  test(`plano ${nombre}: pantalla completa con mar, rotado y sin rotar`, async ({ page }) => {
    test.setTimeout(240_000)
    await login(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/plano')
    await esperarCarga(page)
    await page.getByTitle('Ver en pantalla completa').first().click()
    await page.waitForTimeout(900)

    // el modal ocupa el viewport en mobile (sin radio, sin margen, 100dvh); en desktop sigue siendo 90%
    const hoja = await page.evaluate(() => {
      const el = document.querySelector('.plano-fullscreen-sheet') as HTMLElement
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height, radios: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius], borde: cs.borderTopWidth }
    })
    if (nombre === 'mobile') {
      expect(hoja).toMatchObject({ x: 0, y: 0, w, h })
      expect(hoja.radios).toEqual(['0px', '0px', '0px', '0px'])
      expect(hoja.borde).toBe('0px')
    } else {
      expect(hoja.w).toBeLessThan(w)
      expect(hoja.radios[0]).not.toBe('0px')
    }

    if (nombre === 'desktop') {
      // logo 44px a la izquierda, X circular de 44px a la derecha, centrados con los controles
      const logo = await rect(page, '.plano-fullscreen-sheet img[alt="Prius"]')
      const x = await rect(page, '.plano-fullscreen-sheet button[title="Cerrar pantalla completa"]')
      const fecha = await page.evaluate(() => {
        const d = document.querySelector('.plano-fullscreen-sheet input[readonly]')!.closest('div.flex.items-center.gap-1') as HTMLElement
        const r = d.getBoundingClientRect()
        return { x: r.x, y: r.y, b: r.bottom, radio: getComputedStyle(d).borderTopLeftRadius }
      })
      const seg = await page.evaluate(() => {
        const g = document.querySelector('.plano-fullscreen-sheet [aria-label="Filtrar el plano por tipo de unidad"]') as HTMLElement
        const r = g.getBoundingClientRect()
        return { x: r.x, y: r.y, b: r.bottom, radio: getComputedStyle(g).borderTopLeftRadius }
      })
      expect(logo!.w).toBe(44); expect(logo!.h).toBe(44)
      expect(x!.w).toBe(44); expect(x!.h).toBe(44)
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('.plano-fullscreen-sheet button[title="Cerrar pantalla completa"]')!).borderTopLeftRadius)).toBe('9999px')
      expect(fecha.x - logo!.r, 'gap logo → fecha = 16px').toBeGreaterThanOrEqual(15.5)
      expect(fecha.x - logo!.r).toBeLessThanOrEqual(16.5)
      const centro = (y: number, b: number) => (y + b) / 2
      expect(Math.abs(centro(logo!.y, logo!.b) - centro(fecha.y, fecha.b))).toBeLessThanOrEqual(1.5)
      expect(Math.abs(centro(x!.y, x!.b) - centro(logo!.y, logo!.b))).toBeLessThanOrEqual(1.5)
      expect(fecha.radio, 'navegador de fecha en pill').toBe(seg.radio)
      expect(Number.parseFloat(fecha.radio)).toBeGreaterThan(100)
      // X pegada al borde derecho de la card de controles
      const card = await rect(page, '.plano-fullscreen-sheet [data-card-compacta]')
      expect(card!.r - x!.r).toBeLessThanOrEqual(13)
    }

    const marcos = async () => page.evaluate(() => {
      const mar = document.querySelector('[data-plano-mar]') as HTMLElement
      const rot = document.querySelector('[data-plano-rotable]') as HTMLElement
      const m = mar.getBoundingClientRect()
      const p = rot.getBoundingClientRect()
      const celdas = [...document.querySelectorAll('[data-plano-rotable] button[data-deeplink-id]')].map((b) => b.getBoundingClientRect())
      const pisa = celdas.filter((c) => c.left < m.right && c.right > m.left && c.top < m.bottom && c.bottom > m.top).length
      const et = [...mar.querySelectorAll('span.plano-contra')].find((e) => e.textContent?.includes('Océano'))!
      let mm = new DOMMatrix()
      for (let n: Element | null = et; n && n !== document.body; n = n.parentElement) {
        const t = getComputedStyle(n).transform
        if (t !== 'none') mm = new DOMMatrix(t).multiply(mm)
      }
      const er = et.getBoundingClientRect()
      return {
        mar: { x: m.x, y: m.y, r: m.right, b: m.bottom, w: m.width, h: m.height },
        plano: { x: p.x, y: p.y, r: p.right, b: p.bottom, w: p.width },
        pisa,
        paths: mar.querySelectorAll('svg path').length,
        svgBytes: mar.querySelector('svg')!.outerHTML.length,
        imgs: mar.querySelectorAll('img, image').length,
        etiquetaAngulo: Math.abs(Math.round((Math.atan2(mm.b, mm.a) * 180) / Math.PI)),
        etiqueta: { x: er.x, r: er.right, y: er.y, b: er.bottom },
        texto: getComputedStyle(et).color,
        vw: window.innerWidth, vh: window.innerHeight,
      }
    })

    for (const rotado of [false, true]) {
      if (rotado) {
        await page.getByRole('button', { name: 'Rotar el plano 180°' }).click()
        await page.waitForTimeout(1000)
      }
      const c = await marcos()
      console.log(`${nombre} rotado=${rotado}: mar=${JSON.stringify(c.mar)} plano=${JSON.stringify(c.plano)} paths=${c.paths} bytes=${c.svgBytes}`)
      expect(c.paths).toBeLessThanOrEqual(5)
      expect(c.svgBytes).toBeLessThan(6144)
      expect(c.imgs).toBe(0)
      expect(c.pisa, 'el mar no tapa ninguna unidad').toBe(0)
      // ocupa todo el ancho del plano
      expect(Math.abs(c.mar.x - c.plano.x)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(c.mar.r - c.plano.r)).toBeLessThanOrEqual(1.5)
      // queda encuadrado dentro del viewport en las dos orientaciones
      expect(c.mar.x).toBeGreaterThanOrEqual(0); expect(c.mar.r).toBeLessThanOrEqual(c.vw)
      expect(c.mar.y).toBeGreaterThanOrEqual(0); expect(c.mar.b).toBeLessThanOrEqual(c.vh)
      // rotado el mar queda del lado opuesto del plano (arriba), sin rotar abajo
      const mitad = (c.plano.y + c.plano.b) / 2
      if (rotado) expect(c.mar.y + c.mar.h / 2).toBeLessThan(mitad)
      else expect(c.mar.y + c.mar.h / 2).toBeGreaterThan(mitad)
      // rótulo derecho y legible (oscuro sobre azul claro)
      expect(c.etiquetaAngulo).toBe(0)
      expect(c.etiqueta.x).toBeGreaterThanOrEqual(c.mar.x); expect(c.etiqueta.r).toBeLessThanOrEqual(c.mar.r)
      expect(c.etiqueta.y).toBeGreaterThanOrEqual(c.mar.y); expect(c.etiqueta.b).toBeLessThanOrEqual(c.mar.b)
      expect(c.texto).toBe('rgb(12, 74, 110)')
      if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}-completa-${rotado ? 'rotado' : 'normal'}.png` })
    }

    // las olas se mueven (translateX) y con prefers-reduced-motion quedan quietas
    const trans = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-plano-mar] .plano-ola')!).transform)
    const t1 = await trans(); await page.waitForTimeout(700); const t2 = await trans()
    expect(t1, 'las olas se mueven').not.toBe(t2)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-plano-mar] .plano-ola')!).animationName)).toBe('none')
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    // cerrar: la X en desktop, el botón de la pill en mobile; Esc también
    await page.getByTitle('Cerrar pantalla completa').first().click()
    await page.waitForTimeout(600)
    await expect(page.locator('.plano-fullscreen-sheet')).toHaveCount(0)
    await expect(page.locator('[data-plano-mar]')).toHaveCount(0)
    await page.getByTitle('Ver en pantalla completa').first().click()
    await page.waitForTimeout(600)
    await expect(page.locator('.plano-fullscreen-sheet')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    await expect(page.locator('.plano-fullscreen-sheet'), 'Esc cierra la pantalla completa').toHaveCount(0)
  })
}

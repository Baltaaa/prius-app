import { test, expect } from './fixtures'

// Login mobile: sin scroll de página, sin scroll interno del formulario y sin espacio en blanco
// sobrante, en los celulares chicos y grandes. Con el teclado "abierto" (viewport achicado) el
// campo enfocado queda visible y la página no salta. Sin sesión: no escribe nada.
const CELULARES: [number, number][] = [[360, 640], [375, 667], [390, 844], [430, 932]]

for (const [w, h] of CELULARES) {
  test(`login ${w}x${h}: cero scroll y cero espacio sobrante`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/login')
    await page.getByLabel('Email').waitFor()
    await page.waitForTimeout(600) // animación de entrada del sheet

    const m = await page.evaluate(() => {
      const main = document.querySelector('main') as HTMLElement
      const scroller = main.firstElementChild as HTMLElement
      const sheet = scroller.firstElementChild as HTMLElement
      const root = main.closest('.overflow-hidden.bg-ink') as HTMLElement
      const hero = root.querySelector('img[alt="Prius Playa Grande"]')!.parentElement as HTMLElement
      const r = (e: HTMLElement) => e.getBoundingClientRect()
      return {
        vw: innerWidth, vh: innerHeight,
        docScroll: document.documentElement.scrollHeight - innerHeight,
        docScrollX: document.documentElement.scrollWidth - innerWidth,
        scrollerOverflow: scroller.scrollHeight - scroller.clientHeight,
        mainBottom: r(main).bottom, sheetBottom: r(sheet).bottom, mainTop: r(main).top,
        heroTop: r(hero).top, heroH: r(hero).height, heroBottom: r(hero).bottom,
        rootTop: r(root).top, rootH: r(root).height,
        scrollY: scrollY,
        btn: r(document.querySelector('button[type=submit]') as HTMLElement).bottom,
        sheetStyle: getComputedStyle(sheet).paddingBottom,
      }
    })
    expect(m.docScroll, 'scroll vertical de página').toBeLessThanOrEqual(0)
    expect(m.docScrollX, 'scroll horizontal').toBeLessThanOrEqual(0)
    expect(m.scrollerOverflow, 'scroll interno del formulario').toBeLessThanOrEqual(0)
    expect(m.rootTop).toBe(0)
    expect(Math.abs(m.rootH - m.vh), 'la raíz llena el alto exacto').toBeLessThanOrEqual(1)
    expect(Math.abs(m.mainBottom - m.vh), 'sin espacio en blanco debajo del formulario').toBeLessThanOrEqual(1)
    expect(Math.abs(m.heroBottom - m.mainTop), 'sin hueco entre la franja de marca y el formulario').toBeLessThanOrEqual(1)
    expect(m.heroTop).toBe(0)
    expect(m.heroH, 'franja de marca visible').toBeGreaterThanOrEqual(80)
    expect(m.btn, 'el botón Ingresar entra en pantalla').toBeLessThanOrEqual(m.vh)
    expect(m.scrollY).toBe(0)
  })

  test(`login ${w}x${h}: con el teclado abierto el campo enfocado queda visible y la página no salta`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/login')
    await page.getByLabel('Email').waitFor()
    await page.waitForTimeout(600)
    // Teclado de ~42% del alto: el viewport visual se achica.
    const visible = Math.round(h * 0.58)
    await page.setViewportSize({ width: w, height: visible })
    await page.getByRole('textbox', { name: 'Contraseña' }).focus()
    await page.waitForTimeout(700)
    const m = await page.evaluate(() => {
      const el = document.getElementById('login-password')!.getBoundingClientRect()
      return { top: el.top, bottom: el.bottom, vh: innerHeight, scrollY, docScroll: document.documentElement.scrollHeight - innerHeight }
    })
    expect(m.top).toBeGreaterThanOrEqual(0)
    expect(m.bottom).toBeLessThanOrEqual(m.vh)
    expect(m.scrollY).toBe(0)
    expect(m.docScroll).toBeLessThanOrEqual(0)
  })
}

test('login desktop 1440: sigue pantalla dividida sin scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.getByLabel('Email').waitFor()
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight - innerHeight, img: document.querySelector('img[alt="Prius Playa Grande"]')!.parentElement!.getBoundingClientRect().width }))
  expect(m.doc).toBeLessThanOrEqual(0)
  expect(Math.abs(m.img - 720)).toBeLessThanOrEqual(1)
})

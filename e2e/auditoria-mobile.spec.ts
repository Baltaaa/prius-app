import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

// Copia local de e2e/fixtures.ts login() con timeout más largo — en mobile
// (360/390) el login real contra Supabase tardó más de los 15s que usa el
// resto de la suite en desktop; no se toca fixtures.ts (es compartido) solo
// para esta auditoría.
async function loginMobile(page: Page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Faltan E2E_USER_EMAIL / E2E_USER_PASSWORD en .env.local — ver .env.local.example.')
  }
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(PASSWORD)
  await page.getByRole('button', { name: /^ingresar$/i }).click()
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 40_000 })
}

// Fase 0 del plan mobile — AUDITORÍA pura, no toca la app. Recorre todas las
// rutas de /app + los estados de overlay más comunes en los dos tamaños de
// referencia (360x780 y 390x844, los mismos de e2e/plano-visual.spec.ts) y
// junta, por pantalla: screenshot full-page, scroll horizontal, objetivos
// táctiles < 44x44, texto < 12px, inputs sin inputMode/con riesgo de zoom
// iOS (font-size < 16px) y elementos tapados por el BottomNav.
//
// No corre bajo los projects mobile-360/mobile-390 de playwright.config.ts
// (esos projects limitan su testMatch a plano(-publico)?-visual.spec.ts, y
// esta fase no puede tocar ese archivo) — en cambio corre bajo el project
// `desktop-1440` (testMatch /.*\.spec\.ts/ sin filtrar por nombre) y fija el
// viewport/isMobile/hasTouch/deviceScaleFactor a mano por describe block,
// con los mismos valores que esos dos projects. Resultado idéntico, sin
// editar el config.
//
// Nada de lo que hace este archivo escribe en la base: cada estado se abre
// y se cierra sin tocar ningún botón de guardar/confirmar/cobrar.

const OUT_DIR = path.join(process.cwd(), 'test-results', 'auditoria-mobile')
const RESULTS_PATH = path.join(OUT_DIR, 'resultados.json')

type Hallazgo = {
  pantalla: string
  viewport: string
  scrollHorizontal: boolean
  scrollHorizontalPx: number
  objetivosChicos: { selector: string; w: number; h: number; texto: string }[]
  totalObjetivosChicos: number
  textoChico: { selector: string; fontSize: number; texto: string }[]
  totalTextoChico: number
  inputsRiesgoZoom: { selector: string; fontSize: number; type: string; inputMode: string | null }[]
  tapadosPorBottomNav: { selector: string; texto: string }[]
  error: string | null
}

const resultados: Hallazgo[] = []

fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = {
  'mobile-360': { width: 360, height: 780 },
  'mobile-390': { width: 390, height: 844 },
} as const

// Rutas reales bajo /app (ver src/App.jsx). "reportes" requiere permiso
// reportes_globales — la cuenta e2e lo tiene (superadmin), igual que en el
// resto de la suite.
const RUTAS = [
  { nombre: 'Home', path: '/app/home' },
  { nombre: 'Plano', path: '/app/plano' },
  { nombre: 'Cabinas y Lockers', path: '/app/cabinas-lockers' },
  { nombre: 'Recepción', path: '/app/recepcion' },
  { nombre: 'Reservas', path: '/app/reservas' },
  { nombre: 'Clientes', path: '/app/clientes' },
  { nombre: 'Caja', path: '/app/caja' },
  { nombre: 'Reportes', path: '/app/reportes' },
  { nombre: 'Ocupación', path: '/app/ocupacion' },
  { nombre: 'Historial', path: '/app/historial' },
  { nombre: 'Notificaciones', path: '/app/notificaciones' },
  { nombre: 'Leads', path: '/app/leads' },
  { nombre: 'Comprobantes', path: '/app/comprobantes' },
  { nombre: 'Perfil', path: '/app/perfil' },
]

async function waitGlobalLoaderGone(page: Page) {
  // GlobalLoader.jsx: overlay fixed inset-0 z-[9999] con "Sincronizando..."
  // u otro mensaje — Recepción quedó atascado en "Verificando credenciales"
  // en el barrido anterior (ver CLAUDE.md "Pendiente"), así que acá se le
  // da bastante margen antes de dar la pantalla por cargada.
  const loader = page.locator('text=/Sincronizando|Verificando|Cargando/').first()
  try {
    await loader.waitFor({ state: 'hidden', timeout: 20_000 })
  } catch {
    // Si 20s no alcanzaron, se registra como parte de los hallazgos de esa
    // pantalla (ver chequeo() más abajo) en vez de reventar todo el spec.
  }
  await page.waitForTimeout(400) // asienta animaciones de entrada / fetch inicial
}

async function medirScrollHorizontal(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement
    if (!el) return { over: false, px: 0 }
    const over = el.scrollWidth > window.innerWidth
    return { over, px: Math.max(0, el.scrollWidth - window.innerWidth) }
  })
}

async function medirObjetivosChicos(page: Page) {
  return page.evaluate(() => {
    const MIN = 44
    const seleccionables = Array.from(
      document.querySelectorAll('button, a[href], [role="button"], input, select, textarea'),
    ) as HTMLElement[]
    const out: { selector: string; w: number; h: number; texto: string }[] = []
    for (const el of seleccionables) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue // oculto/desmontado
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (r.width < MIN || r.height < MIN) {
        const texto = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 40)
        const sel = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : '')
        out.push({ selector: sel, w: Math.round(r.width), h: Math.round(r.height), texto })
      }
    }
    return out
  })
}

async function medirTextoChico(page: Page) {
  return page.evaluate(() => {
    const MIN = 12
    const out: { selector: string; fontSize: number; texto: string }[] = []
    const nodos = Array.from(document.querySelectorAll('body *')) as HTMLElement[]
    for (const el of nodos) {
      if (!el.textContent || !el.textContent.trim()) continue
      // Solo elementos "hoja" de texto (sin hijos con texto propio), para no
      // contar el mismo texto dos veces por contenedor + hijo.
      const tieneHijoConTexto = Array.from(el.children).some((c) => (c.textContent || '').trim().length > 0)
      if (tieneHijoConTexto) continue
      const style = window.getComputedStyle(el)
      const fs = parseFloat(style.fontSize)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (fs > 0 && fs < MIN) {
        const sel = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : '')
        out.push({ selector: sel, fontSize: fs, texto: el.textContent.trim().slice(0, 40) })
      }
    }
    return out
  })
}

async function medirInputsRiesgoZoom(page: Page) {
  return page.evaluate(() => {
    const out: { selector: string; fontSize: number; type: string; inputMode: string | null }[] = []
    const inputs = Array.from(document.querySelectorAll('input, textarea')) as HTMLInputElement[]
    for (const el of inputs) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const style = window.getComputedStyle(el)
      const fs = parseFloat(style.fontSize)
      const type = el.type || 'text'
      const inputMode = el.getAttribute('inputmode')
      const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').slice(0, 30)
      const esNumericoEsperado = /monto|precio|dni|cuit|telefono|phone|numero|cantidad/i.test(
        (el.name || '') + (el.id || '') + (el.getAttribute('aria-label') || '') + (el.getAttribute('placeholder') || ''),
      )
      const faltaInputMode = esNumericoEsperado && type === 'text' && inputMode !== 'numeric' && inputMode !== 'decimal' && inputMode !== 'tel'
      const riesgoZoomIOS = fs > 0 && fs < 16
      if (faltaInputMode || riesgoZoomIOS) {
        out.push({ selector: `input[${label || type}]`, fontSize: fs, type, inputMode })
      }
    }
    return out
  })
}

async function medirTapadosPorBottomNav(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null
    if (!nav) return []
    const navRect = nav.getBoundingClientRect()
    if (navRect.height === 0) return []
    const out: { selector: string; texto: string }[] = []
    const candidatos = Array.from(document.querySelectorAll('button, a[href], [role="button"]')) as HTMLElement[]
    for (const el of candidatos) {
      if (nav.contains(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const style = window.getComputedStyle(el)
      if (style.position === 'fixed') continue // elementos propios que ya se posicionan por encima a propósito (ej. FAB bien hecho)
      const seSuperpone = r.bottom > navRect.top && r.top < navRect.bottom && r.right > navRect.left && r.left < navRect.right
      if (!seSuperpone) continue
      // El rect se superpone en coordenadas, pero eso no alcanza — un modal o
      // bottom sheet con z-index más alto que el BottomNav (z-30) se dibuja
      // VISUALMENTE encima a propósito (ver CLAUDE.md "Modales → bottom
      // sheet"), tapado en el DOM pero no al ojo. Hit-test real con
      // elementFromPoint en el centro del elemento: si lo que la devuelve es
      // el propio candidato (o lo contiene), sigue siendo clickeable de
      // verdad — recién cuenta como tapado si el hit-test devuelve el nav o
      // algo adentro de él.
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1)
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1)
      const top = document.elementFromPoint(cx, cy)
      const realmenteTapado = !!top && (nav.contains(top)) && !el.contains(top) && !top.contains(el)
      if (realmenteTapado) {
        const texto = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)
        const sel = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : '')
        out.push({ selector: sel, texto })
      }
    }
    return out.slice(0, 10)
  })
}

async function chequeo(page: Page, pantalla: string, viewport: string, screenshotName: string, errorPrevio: string | null = null) {
  let error = errorPrevio
  let scroll = { over: false, px: 0 }
  let objetivosChicos: Hallazgo['objetivosChicos'] = []
  let textoChico: Hallazgo['textoChico'] = []
  let inputsRiesgoZoom: Hallazgo['inputsRiesgoZoom'] = []
  let tapadosPorBottomNav: Hallazgo['tapadosPorBottomNav'] = []
  try {
    scroll = await medirScrollHorizontal(page)
    objetivosChicos = await medirObjetivosChicos(page)
    textoChico = await medirTextoChico(page)
    inputsRiesgoZoom = await medirInputsRiesgoZoom(page)
    // Tapados por BottomNav: solo cuenta si el elemento SIGUE tapado después
    // de scrollear el contenedor hasta el final — si no, es el solapamiento
    // normal y transitorio de cualquier fixed bottom nav sobre contenido que
    // todavía no se scrolleó, no un bug. pb-20/pb-12 de AppLayout.jsx debería
    // dejar ese espacio libre; si el elemento sigue tapado al fondo, el
    // padding no alcanza para ESA pantalla.
    // Scrollea #app-main-scroll (AppLayout.jsx) Y cualquier contenedor con su
    // propio scroll interno (ej. Modal.jsx, bottom sheets) — un modal grande
    // como "Nueva reserva" tiene su overflow-y-auto propio, independiente del
    // scroll de la página de atrás.
    await page.evaluate(() => {
      const main = document.getElementById('app-main-scroll')
      if (main) main.scrollTop = main.scrollHeight
      document.querySelectorAll('*').forEach((el) => {
        const h = el as HTMLElement
        const style = window.getComputedStyle(h)
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && h.scrollHeight > h.clientHeight + 4) {
          h.scrollTop = h.scrollHeight
        }
      })
    })
    await page.waitForTimeout(150)
    tapadosPorBottomNav = await medirTapadosPorBottomNav(page)
    await page.evaluate(() => {
      const main = document.getElementById('app-main-scroll')
      if (main) main.scrollTop = 0
      document.querySelectorAll('*').forEach((el) => {
        const h = el as HTMLElement
        const style = window.getComputedStyle(h)
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') h.scrollTop = 0
      })
    })
  } catch (e) {
    error = (error ? error + ' | ' : '') + 'chequeo DOM: ' + String(e)
  }
  try {
    await page.screenshot({ path: path.join(OUT_DIR, `${screenshotName}.png`), fullPage: true, timeout: 10_000 })
  } catch (e) {
    error = (error ? error + ' | ' : '') + 'screenshot: ' + String(e)
  }
  // Orden descendente por área faltante — los "5 peores" pedidos en el
  // objetivo, no los primeros 5 que aparezcan en el DOM.
  objetivosChicos.sort((a, b) => a.w * a.h - b.w * b.h)
  textoChico.sort((a, b) => a.fontSize - b.fontSize)
  resultados.push({
    pantalla,
    viewport,
    scrollHorizontal: scroll.over,
    scrollHorizontalPx: Math.round(scroll.px),
    objetivosChicos: objetivosChicos.slice(0, 5),
    totalObjetivosChicos: objetivosChicos.length,
    textoChico: textoChico.slice(0, 5),
    totalTextoChico: textoChico.length,
    inputsRiesgoZoom,
    tapadosPorBottomNav,
    error,
  })
}

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Auditoría mobile — ${viewportName}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })

    test(`${viewportName}: rutas de /app`, async ({ page }) => {
      test.setTimeout(5 * 60_000) // 14 rutas con screenshot full-page + chequeos DOM, el default de 30s no alcanza
      await loginMobile(page)
      await waitGlobalLoaderGone(page)

      for (const ruta of RUTAS) {
        let error: string | null = null
        try {
          await page.goto(ruta.path)
          await waitGlobalLoaderGone(page)
        } catch (e) {
          error = 'navegación: ' + String(e)
        }
        await chequeo(page, ruta.nombre, viewportName, `${viewportName}__${ruta.nombre.replace(/\s+/g, '-')}`, error)
      }
    })

    test(`${viewportName}: estados de overlay`, async ({ page }) => {
      test.setTimeout(5 * 60_000) // 7 estados de overlay, cada uno con su propia navegación + chequeos
      await loginMobile(page)
      await waitGlobalLoaderGone(page)

      // --- Menú "Más" del BottomNav ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/home')
          await waitGlobalLoaderGone(page)
          await page.getByRole('button', { name: 'Más' }).click()
          await page.waitForTimeout(300)
        } catch (e) {
          error = String(e)
        }
        await chequeo(page, 'BottomNav — Más abierto', viewportName, `${viewportName}__bottomnav-mas`, error)
        await page.keyboard.press('Escape').catch(() => {})
      }

      // --- Búsqueda mobile del TopBar ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/home')
          await waitGlobalLoaderGone(page)
          await page.locator('header button:has(svg)').first().click() // ícono lupa, ver TopBar.jsx (sm:hidden)
          await page.waitForTimeout(300)
        } catch (e) {
          error = String(e)
        }
        await chequeo(page, 'TopBar — búsqueda mobile abierta', viewportName, `${viewportName}__topbar-busqueda`, error)
        await page.keyboard.press('Escape').catch(() => {})
      }

      // --- UnidadPreviewModal desde el Plano ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/plano')
          await waitGlobalLoaderGone(page)
          await page.waitForTimeout(800) // ~184 <Cell> tardan un pelo en pintar tras el fetch de unidades/reservas
          const celda = page.locator('[class*="cursor-pointer"]').first()
          await celda.click({ timeout: 10_000 })
          await page.waitForTimeout(400)
        } catch (e) {
          error = 'UnidadPreviewModal: ' + String(e)
        }
        await chequeo(page, 'Plano — UnidadPreviewModal abierto', viewportName, `${viewportName}__unidad-preview-modal`, error)
        await page.keyboard.press('Escape').catch(() => {})
      }

      // --- Ficha de cliente expandida ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/clientes')
          await waitGlobalLoaderGone(page)
          await page.waitForTimeout(500)
          // Fila-tarjeta clickeable completa (ver Clientes.jsx, handleToggleExpand) — la primera de la lista.
          const fila = page.locator('[class*="cursor-pointer"]').first()
          await fila.click({ timeout: 10_000 })
          await page.waitForTimeout(400)
        } catch (e) {
          error = 'Ficha cliente: ' + String(e)
        }
        await chequeo(page, 'Clientes — ficha expandida', viewportName, `${viewportName}__ficha-cliente`, error)
      }

      // --- Modal "Nueva reserva" ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/reservas')
          await waitGlobalLoaderGone(page)
          await page.getByRole('button', { name: /nueva reserva/i }).first().click({ timeout: 10_000 })
          await page.waitForTimeout(400)
        } catch (e) {
          error = 'Modal Nueva reserva: ' + String(e)
        }
        await chequeo(page, 'Reservas — Modal Nueva reserva', viewportName, `${viewportName}__modal-nueva-reserva`, error)
        await page.keyboard.press('Escape').catch(() => {})
        await page.keyboard.press('Escape').catch(() => {}) // por si pide confirmar descarte (isDirty)
      }

      // --- RegistrarPago con el date picker del comprobante abierto ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/clientes')
          await waitGlobalLoaderGone(page)
          await page.waitForTimeout(500)
          const fila = page.locator('[class*="cursor-pointer"]').first()
          await fila.click({ timeout: 10_000 })
          await page.waitForTimeout(400)
          // Ícono billetera / "+ Cargar" de la fila expandida, ver Clientes.jsx (setPagoCliente/setPagoCelda)
          const abrirPago = page.locator('button[title="Registrar pago"], button:has-text("+ Cargar"), button:has-text("Registrar pago")').first()
          await abrirPago.click({ timeout: 10_000 })
          await page.waitForTimeout(400)
          // Toggle de comprobante: arranca cerrado con el label "Lo cargo
          // después" (comprobanteAbierto=false) y pasa a "Cargar comprobante
          // ahora" + el DateInput recién al abrirse (ver RegistrarPago.jsx).
          const toggleComprobante = page.getByText(/lo cargo después|cargar comprobante ahora/i).first()
          await toggleComprobante.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {})
          if (await toggleComprobante.isVisible().catch(() => false)) {
            await toggleComprobante.click({ timeout: 5_000 }).catch(() => {})
            await page.waitForTimeout(200)
          }
          const fechaInput = page.getByLabel('Fecha').first()
          await fechaInput.click({ timeout: 10_000 })
          await page.waitForTimeout(300)
        } catch (e) {
          error = 'RegistrarPago + date picker: ' + String(e)
        }
        await chequeo(page, 'RegistrarPago — date picker abierto', viewportName, `${viewportName}__registrarpago-datepicker`, error)
        await page.keyboard.press('Escape').catch(() => {})
        await page.keyboard.press('Escape').catch(() => {})
      }

      // --- CerrarCajaStepper ---
      {
        let error: string | null = null
        try {
          await page.goto('/app/caja')
          await waitGlobalLoaderGone(page)
          await page.waitForTimeout(500)
          const btnCerrar = page.getByRole('button', { name: /cerrar caja/i }).first()
          if (await btnCerrar.isVisible().catch(() => false)) {
            await btnCerrar.click({ timeout: 10_000 })
            await page.waitForTimeout(400)
          } else {
            error = 'Sin caja abierta para probar el stepper (botón "Cerrar Caja" no visible)'
          }
        } catch (e) {
          error = 'CerrarCajaStepper: ' + String(e)
        }
        await chequeo(page, 'Caja — CerrarCajaStepper', viewportName, `${viewportName}__cerrar-caja-stepper`, error)
        await page.keyboard.press('Escape').catch(() => {})
      }
    })
  })
}

test.afterAll(async () => {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(resultados, null, 2))
})

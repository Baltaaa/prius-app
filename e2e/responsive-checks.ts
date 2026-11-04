import type { Page } from '@playwright/test'

// Chequeos de layout del Paso 5 (checklist responsive de design/DESIGN.md).
// Corren dentro de la página y devuelven hallazgos legibles; no tocan nada.
export type Hallazgo = { regla: string; detalle: string }

export async function auditarLayout(page: Page, opts: { mobile: boolean; sinNav?: boolean } = { mobile: false }): Promise<Hallazgo[]> {
  return page.evaluate(({ mobile, sinNav }) => {
    const out: { regla: string; detalle: string }[] = []
    const etiqueta = (e: Element) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : ''} "${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28)}"`
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      const s = getComputedStyle(e)
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
    }
    // El mapa del plano es una excepción documentada (se pinta con transform).
    const enMapa = (e: Element) => !!e.closest('[style*="touch-action"], .plano-print, #print-root')
    const raices: Element[] = [document.querySelector('#app-main-scroll') ?? document.body]
    document.querySelectorAll('.fixed.inset-0, [role="dialog"]').forEach((o) => raices.push(o))

    // 1. Scroll horizontal del documento.
    const se = document.scrollingElement!
    if (se.scrollWidth > innerWidth) out.push({ regla: 'scroll-horizontal', detalle: `scrollWidth ${se.scrollWidth} > ${innerWidth}` })
    const main = document.querySelector('#app-main-scroll') as HTMLElement | null
    if (main && main.scrollWidth > main.clientWidth + 1) out.push({ regla: 'scroll-horizontal', detalle: `main scrollWidth ${main.scrollWidth} > ${main.clientWidth}` })

    const esContenedor = (e: Element) => {
      const c = typeof e.className === 'string' ? e.className : ''
      return /(^|\s)(card-surface|card-inner|rounded-card|rounded-inner)(\s|$)/.test(c) || e.getAttribute('role') === 'dialog'
    }
    const scrollH = (e: Element) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowX) }

    const vistos = new Set<string>()
    for (const raiz of raices) {
      raiz.querySelectorAll('*').forEach((el) => {
        if (enMapa(el) || el.closest('.sr-only') || !visible(el)) return
        const tag = el.tagName
        // Las formas SVG decorativas (patrones, curvas) se recortan a propósito.
        if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') return
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)

        // 2. Desborda su card o modal: el hijo se sale por los costados de su
        // contenedor (lo que se sale queda cortado o pisa al vecino).
        if (s.position !== 'fixed' && s.position !== 'absolute') {
          let cont: Element | null = el.parentElement
          let scrollAntes = false
          while (cont && !esContenedor(cont)) { if (scrollH(cont)) scrollAntes = true; cont = cont.parentElement }
          // Un contenedor con scroll horizontal propio (tablas, vista previa A4) se desplaza a propósito.
          if (cont && !scrollAntes && cont !== el && !scrollH(cont)) {
            const c = cont.getBoundingClientRect()
            if (r.right > c.right + 1.5 || r.left < c.left - 1.5) {
              const clave = `desborda|${etiqueta(el)}`
              if (!vistos.has(clave)) { vistos.add(clave); out.push({ regla: 'desborda-contenedor', detalle: `${etiqueta(el)} [${Math.round(r.left)}-${Math.round(r.right)}] fuera de ${etiqueta(cont)} [${Math.round(c.left)}-${Math.round(c.right)}]` }) }
            }
          }
        }

        // 3. Texto cortado con puntos suspensivos o recortado sin title. Los
        // montos y los nombres nunca pueden quedar así.
        if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
          const corta = el.scrollWidth > el.clientWidth + 1 && (s.textOverflow === 'ellipsis' || s.overflow === 'hidden' || s.overflowX === 'hidden')
          if (corta) {
            let conTitle = false
            for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) { if (n.getAttribute('title') || n.getAttribute('aria-label')) { conTitle = true; break } }
            const esMonto = /\$\s?\d|US\$|USD/.test(el.textContent)
            if (!conTitle || esMonto) out.push({ regla: esMonto ? 'monto-cortado' : 'texto-cortado-sin-title', detalle: etiqueta(el) })
          }
        }

        // 4. Mobile: inputs de 16px (sin zoom de iOS).
        if (mobile && ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) && !['checkbox', 'radio', 'hidden', 'file'].includes((el as HTMLInputElement).type) && parseFloat(s.fontSize) < 16) {
          out.push({ regla: 'input-menor-16px', detalle: `${etiqueta(el)} ${s.fontSize}` })
        }
        // Mobile: touch target de 44px en botones y links propios.
        if (mobile && (tag === 'BUTTON' || (tag === 'A' && el.getAttribute('href'))) && (r.height < 43.5 || r.width < 43.5)) {
          // Los links de texto dentro de un párrafo y las celdas del mapa no cuentan.
          const enTexto = tag === 'A' && el.closest('p, li, span, td')
          const clave = `touch|${etiqueta(el)}`
          if (!enTexto && !vistos.has(clave)) { vistos.add(clave); out.push({ regla: 'touch-menor-44px', detalle: `${etiqueta(el)} ${Math.round(r.width)}x${Math.round(r.height)}` }) }
        }
      })
    }

    // 5. La bottom nav no tapa contenido: scrolleado al final, nada de lo
    // visible en main queda debajo del borde superior de la nav.
    if (mobile && !sinNav && main) {
      const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom >= innerHeight - 2)
      if (nav) {
        const prev = main.scrollTop
        main.scrollTop = main.scrollHeight
        const top = nav.getBoundingClientRect().top
        let maxBottom = 0
        let culpable: Element | null = null
        main.querySelectorAll('*').forEach((e) => {
          if (!visible(e) || e.children.length > 0 || enMapa(e)) return
          const b = e.getBoundingClientRect()
          if (b.top < innerHeight && b.bottom > maxBottom && b.bottom <= innerHeight + 400) { maxBottom = b.bottom; culpable = e }
        })
        if (maxBottom > top + 1) out.push({ regla: 'bottom-nav-tapa-contenido', detalle: `contenido llega a ${Math.round(maxBottom)} y la nav empieza en ${Math.round(top)} (${culpable ? etiqueta(culpable) : ''})` })
        main.scrollTop = prev
      }
    }
    return out
  }, opts)
}

export async function esperarCarga(page: Page) {
  await page.locator('#app-main-scroll').waitFor({ timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(700)
  // Sin skeletons ni textos de carga: con varios procesos en paralelo los datos
  // tardan más y una captura temprana mediría el esqueleto, no la pantalla.
  await page.waitForFunction(
    () => !document.querySelector('.skeleton-shimmer, .animate-pulse, [aria-busy="true"]') && !/Cargando/.test(document.body.innerText),
    null,
    { timeout: 25_000 },
  ).catch(() => {})
  await page.waitForTimeout(700)
}

// Bloque 5 (revisión de padding): contenido pegado al borde de su card o pill,
// pills sin aire a los costados y controles hermanos que se tocan. Heurística
// para encontrar candidatos; cada hallazgo se mira a mano antes de corregir.
export async function auditarPadding(page: Page): Promise<Hallazgo[]> {
  return page.evaluate(() => {
    const out: { regla: string; detalle: string }[] = []
    const vistos = new Set<string>()
    const etiqueta = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : ''} "${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      const s = getComputedStyle(e)
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
    }
    const excluido = (e: Element) => !!e.closest('[style*="touch-action"], .plano-print, #print-root, .sr-only, [aria-hidden="true"]')
    const agregar = (regla: string, clave: string, detalle: string) => { if (!vistos.has(regla + clave)) { vistos.add(regla + clave); out.push({ regla, detalle }) } }
    const raices: Element[] = [document.querySelector('#app-main-scroll') ?? document.body]
    document.querySelectorAll('.fixed.inset-0, [role="dialog"]').forEach((o) => raices.push(o))

    const esContenedor = (e: Element) => {
      const c = typeof e.className === 'string' ? e.className : ''
      return /(^|\s)(card-surface|card-inner|surface-pop)(\s|$)/.test(c) || e.getAttribute('role') === 'dialog'
    }
    const tieneTexto = (e: Element) => [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0)

    for (const raiz of raices) {
      raiz.querySelectorAll('*').forEach((el) => {
        if (excluido(el) || !visible(el)) return
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)

        // A. Contenido (texto, ícono, control) a menos de 8px del borde de su card.
        const hoja = tieneTexto(el) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || (el.tagName === 'svg' && !el.closest('button, a')) || (el.tagName === 'BUTTON' && !tieneTexto(el) && el.children.length > 0 && el.getBoundingClientRect().width < 60)
        if (hoja) {
          let cont: Element | null = el.parentElement
          while (cont && !esContenedor(cont)) cont = cont.parentElement
          if (cont && cont !== el) {
            const c = cont.getBoundingClientRect()
            const radio = parseFloat(getComputedStyle(cont).borderTopLeftRadius) || 0
            const izq = r.left - c.left, der = c.right - r.right, arr = r.top - c.top, aba = c.bottom - r.bottom
            const minimo = Math.min(izq, der)
            // Filas que ocupan todo el ancho de la card (listas, tablas con divisores) no cuentan.
            const ancho = r.width >= c.width - 2
            if (!ancho && radio >= 12 && (minimo < 8 || arr < 6 || aba < 6) && !(el.closest('[class*="overflow-y-auto"], table'))) {
              agregar('pegado-al-borde', etiqueta(el) + '|' + etiqueta(cont), `${etiqueta(el)} a ${Math.round(izq)}/${Math.round(der)}/${Math.round(arr)}/${Math.round(aba)}px (izq/der/arr/aba) de ${etiqueta(cont)}`)
            }
          }
        }

        // B. Pill con texto y fondo/borde, pero sin aire a los costados.
        const radioPill = parseFloat(s.borderTopLeftRadius) || 0
        if (tieneTexto(el) && radioPill >= r.height / 2 - 1 && r.width > r.height + 4) {
          const conFondo = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(s.borderTopWidth) > 0
          const pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight)
          if (conFondo && (pl < 8 || pr < 8) && s.display !== 'contents') agregar('pill-sin-aire', etiqueta(el), `${etiqueta(el)} padding ${pl}/${pr}px`)
        }

        // D. Scroll interno con barra visible y sin lugar reservado: la barra se
        // come el padding del contenido (y el layout salta al aparecer).
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          const barra = (el as HTMLElement).offsetWidth - el.clientWidth - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth)
          if (barra >= 6 && s.scrollbarGutter !== 'stable' && el.closest('.card-surface, .surface-pop, [role="dialog"]')) agregar('scroll-sin-gutter', etiqueta(el), `${etiqueta(el)} barra ${Math.round(barra)}px sin scrollbar-gutter: stable`)
        }

        // C. Hermanos interactivos que se tocan o se pisan.
        if (['BUTTON', 'A'].includes(el.tagName) || (radioPill >= r.height / 2 - 1 && s.backgroundColor !== 'rgba(0, 0, 0, 0)')) {
          const sig = el.nextElementSibling
          if (sig && visible(sig) && !excluido(sig)) {
            const sr = sig.getBoundingClientRect()
            const mismaFila = Math.abs((r.top + r.height / 2) - (sr.top + sr.height / 2)) < Math.min(r.height, sr.height) / 2
            const ss = getComputedStyle(sig)
            const interactivo = ['BUTTON', 'A'].includes(sig.tagName) || (parseFloat(ss.borderTopLeftRadius) >= sr.height / 2 - 1 && ss.backgroundColor !== 'rgba(0, 0, 0, 0)')
            const sep = sr.left - r.right
            if (mismaFila && interactivo && sep < 3 && sep > -r.width) agregar('controles-pegados', etiqueta(el) + '|' + etiqueta(sig), `${etiqueta(el)} y ${etiqueta(sig)} a ${Math.round(sep)}px`)
          }
        }
      })
    }
    return out
  })
}

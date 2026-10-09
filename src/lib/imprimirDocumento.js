import { createRoot } from 'react-dom/client'

// CSS de "mecánica de página" — @page, reset de html/body del iframe. El
// diseño del documento en sí (colores, tipografía, layout) lo define
// ComprobanteDocumento.jsx con su propio <style>, montado adentro de este
// mismo iframe: así nunca hay dos hojas de estilo que puedan desincronizarse.
const PAGE_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
`

/**
 * Imprime un elemento React en un iframe oculto, sin arrastrar nada del
 * layout de la app (sidebar/topbar/bottom nav) ni el header/footer que
 * agrega Chrome por default (fecha, URL, título) — eso lo resuelve
 * `@page { margin: 0 }` solo. Objetivo: abrir el diálogo de impresión en
 * menos de 1 segundo, por eso no se espera ninguna fuente externa — el CSS
 * del documento usa la pila de fuentes del sistema a propósito.
 *
 * `titulo`: nombre de archivo sugerido al hacer "Guardar como PDF" (se
 * aplica como document.title del iframe y, temporalmente, del padre).
 */
export function imprimirDocumento(elemento, { titulo } = {}) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
    document.body.appendChild(iframe)

    const idoc = iframe.contentDocument
    idoc.open()
    idoc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
    idoc.close()
    if (titulo) idoc.title = titulo

    const style = idoc.createElement('style')
    style.textContent = PAGE_CSS
    idoc.head.appendChild(style)

    const mountNode = idoc.createElement('div')
    idoc.body.appendChild(mountNode)
    const root = createRoot(mountNode)
    root.render(elemento)

    const tituloOriginal = document.title
    if (titulo) document.title = titulo

    let limpiado = false
    const limpiar = () => {
      if (limpiado) return
      limpiado = true
      document.title = tituloOriginal
      root.unmount()
      iframe.remove()
      resolve()
    }

    iframe.contentWindow.addEventListener('afterprint', limpiar, { once: true })
    // Fallback: algunos navegadores (Chrome Android en ciertas versiones) no
    // disparan `afterprint` de forma confiable si el usuario cancela.
    setTimeout(limpiar, 20000)

    // document.fonts.ready resuelve casi instantáneo (el documento no carga
    // ninguna fuente externa, a propósito — ver nota arriba), pero se espera
    // igual por si alguna vez se agrega una @font-face acá. Un frame extra
    // de render evita imprimir en blanco en navegadores lentos para montar.
    Promise.resolve(idoc.fonts?.ready).then(() => {
      requestAnimationFrame(() => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      })
    })
  })
}

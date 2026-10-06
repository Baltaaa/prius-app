const HIGHLIGHT_CLASS = 'deep-link-highlight'
const HIGHLIGHT_MS = 2500

/**
 * scrollIntoView suave + resaltado con borde #F2CA50 que se desvanece solo
 * (ver `.deep-link-highlight` en index.css). Usado por `useDeepLinkTarget`
 * y por cualquier resultado de búsqueda in-page que ya está en la misma
 * pantalla y solo necesita saltar a un elemento con `data-deeplink-id`.
 */
export function scrollAndHighlight(targetId, delayMs = 150) {
  setTimeout(() => {
    const el = document.querySelector(`[data-deeplink-id="${targetId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add(HIGHLIGHT_CLASS)
    setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS)
  }, delayMs)
}

// Sheet "Más secciones" (BottomNav, mobile): el botón de menú de la barra
// única (PageTopbar) lo abre desde otro subárbol. Un evento del window en vez
// de un provider nuevo — es un solo booleano de UI y el dueño del estado
// sigue siendo BottomNav.
const EVENTO = 'prius:abrir-menu-mas'

export function abrirMenuMas() {
  window.dispatchEvent(new Event(EVENTO))
}

export function suscribirMenuMas(alAbrir) {
  window.addEventListener(EVENTO, alAbrir)
  return () => window.removeEventListener(EVENTO, alAbrir)
}

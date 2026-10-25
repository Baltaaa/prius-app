import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Pulido UX (oct 2026, item 7) — causa raíz del bug real: "BrowserRouter"
// (sin data router) nunca resetea el scroll al navegar, a diferencia de un
// <a href> con carga de documento completo. En iOS Safari eso se nota
// fuerte: con el teclado abierto en el login, Safari desplaza el
// viewport/documento para mantener el input enfocado a la vista — ese
// desplazamiento queda en window.scrollY. Al loguearse y navegar
// (SPA, mismo document) ese scroll residual sigue ahí: el header de
// AppLayout (sticky dentro de #app-main-scroll) aparece "cortado" porque
// el viewport entero seguía corrido.
// Reset en cada cambio de ruta, salvo POP (back/forward del navegador, que
// sí debe conservar la posición anterior — comportamiento nativo esperado).
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType() // 'POP' | 'PUSH' | 'REPLACE'

  useEffect(() => {
    if (navType === 'POP') return
    window.scrollTo(0, 0)
    const main = document.getElementById('app-main-scroll')
    if (main) main.scrollTop = 0
  }, [pathname, navType])

  return null
}

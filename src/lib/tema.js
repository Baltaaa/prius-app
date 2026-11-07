import { flushSync } from 'react-dom'

// Tema de la app: 'claro' (por defecto), 'oscuro' o 'sistema' (sigue a
// prefers-color-scheme en vivo). La preferencia se guarda por usuario y además
// como la última de este dispositivo, que es la que lee public/tema-inicial.js
// antes de que monte React. Todo acceso a localStorage va con try/catch.
export const TEMAS = ['claro', 'oscuro', 'sistema']
export const OPCIONES_TEMA = [
  { value: 'claro', label: 'Claro' },
  { value: 'oscuro', label: 'Oscuro' },
  { value: 'sistema', label: 'Sistema' },
]
// Color de la barra del navegador en mobile = canvas de cada tema.
const COLOR_BARRA = { light: '#F8F7F2', dark: '#0E0E0D' }

const CLAVE_DISPOSITIVO = 'prius:tema'
const claveUsuario = (userId) => `prius:tema:${userId}`

export function leerPreferencia(userId) {
  try {
    const ls = window.localStorage
    const valor = (userId && ls.getItem(claveUsuario(userId))) || ls.getItem(CLAVE_DISPOSITIVO)
    return TEMAS.includes(valor) ? valor : 'claro'
  } catch {
    return 'claro'
  }
}

export function guardarPreferencia(userId, preferencia) {
  try {
    window.localStorage.setItem(CLAVE_DISPOSITIVO, preferencia)
    if (userId) window.localStorage.setItem(claveUsuario(userId), preferencia)
  } catch { /* sin storage: solo vale esta sesión */ }
}

export const consultaSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)')

export function resolverTema(preferencia) {
  return preferencia === 'oscuro' || (preferencia === 'sistema' && consultaSistema()?.matches) ? 'dark' : 'light'
}

// Pone data-theme en <html>. Mientras cambia, `.tema-cambiando` (index.css)
// apaga las transiciones de color: nada parpadea entre una paleta y la otra.
export function aplicarTema(resuelto) {
  const html = document.documentElement
  if (html.getAttribute('data-theme') === resuelto) return
  html.classList.add('tema-cambiando')
  html.setAttribute('data-theme', resuelto)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[resuelto])
  void getComputedStyle(html).color
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('tema-cambiando')))
}

// Origen del reveal: el último toque/click (el botón que eligió el tema) o, con
// teclado, el centro del elemento enfocado.
let ultimoPunto = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { ultimoPunto = { x: e.clientX, y: e.clientY, t: Date.now() } }, true)
}
function origen() {
  if (ultimoPunto && Date.now() - ultimoPunto.t < 2000) return ultimoPunto
  const r = document.activeElement?.getBoundingClientRect?.()
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 0 }
}

// Cambio con reveal circular de 400ms desde el botón (View Transitions). Sin
// soporte o con reduced-motion, cambio instantáneo. `actualizar` corre adentro
// de la transición y tiene que dejar el DOM final de forma sincrónica.
export function cambiarConTransicion(actualizar) {
  const correr = () => flushSync(actualizar)
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reducido) { correr(); return }
  const { x, y } = origen()
  const transicion = document.startViewTransition(correr)
  transicion.ready.then(() => {
    const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
      { duration: 400, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => { /* transición salteada: el tema ya quedó aplicado */ })
}

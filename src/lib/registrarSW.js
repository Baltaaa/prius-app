import { registerSW } from 'virtual:pwa-register'

// Registro del service worker (nov 2026, Tarea 6).
//
// La versión nueva NO se aplica en caliente: el SW queda esperando y toma el
// control en el próximo arranque en frío. Cambiar el JS debajo de una sesión
// con un cobro a medio cargar es la forma más rápida de perder plata, así que
// acá solo se avisa.
//
// El aviso es un toast nativo mínimo (no el DialogProvider): esto corre antes
// de que monte React y no vale la pena acoplarlo al árbol.

const ID = 'prius-aviso-version'

function avisarVersionNueva() {
  if (document.getElementById(ID)) return
  const aviso = document.createElement('div')
  aviso.id = ID
  aviso.setAttribute('role', 'status')
  aviso.textContent = 'Hay una versión nueva. Se aplica la próxima vez que abras la app.'
  // Los colores, el radio y la sombra salen de `surface-pop` (index.css ya
  // está en el <head> cuando esto corre): acá solo la posición.
  aviso.className = 'surface-pop text-label text-ink'
  aviso.style.cssText = [
    'position:fixed',
    'left:50%',
    'transform:translateX(-50%)',
    'bottom:calc(env(safe-area-inset-bottom) + 76px)',
    'z-index:9999',
    'max-width:min(92vw, 420px)',
    'padding:12px 16px',
    'text-align:center',
  ].join(';')
  document.body.appendChild(aviso)
  setTimeout(() => aviso.remove(), 8000)
}

export function registrarServiceWorker() {
  if (import.meta.env.DEV) return
  registerSW({
    immediate: true,
    onNeedRefresh: avisarVersionNueva,
    onRegisterError: (err) => console.warn('[sw] no se pudo registrar:', err),
  })
}

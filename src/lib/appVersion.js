// Única fuente de la versión de la app — nunca repetida a mano en el JSX.
//
// `APP_VERSION` es el texto de marca que el dueño pidió para el footer y el
// sidebar ("BeachFlow v. 1.0"), no un semver.
// `VERSION_PAQUETE` es el número real de package.json, inyectado en el build
// (`__APP_VERSION__`, ver vite.config.js): lo muestra "Acerca de" en
// Configuración, para poder identificar qué está desplegado.
export const APP_VERSION = 'BeachFlow v. 1.0'

export const VERSION_PAQUETE =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

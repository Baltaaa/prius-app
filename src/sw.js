/* eslint-env serviceworker */
/* global clients */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Service worker de Prius (nov 2026, Tarea 6).
//
// `injectManifest` y no `generateSW` porque acá vive el handler de push, que
// un SW generado no puede traer.
//
// Reglas, en una línea:
//  1. Se precachea SOLO el shell (assets con hash, fuentes, íconos). Nada de
//     datos.
//  2. Supabase NUNCA se cachea: rest, auth, realtime, storage y functions
//     son siempre red. Una caja o una reserva viejas servidas de caché serían
//     peor que un error de red.
//  3. La versión nueva NO se aplica en caliente: espera al próximo arranque
//     en frío. Cambiar el JS debajo de una sesión abierta con un formulario a
//     medio llenar es la forma más rápida de perder un cobro.

// `self.__WB_MANIFEST` lo reemplaza vite-plugin-pwa con la lista de archivos
// del build (cada uno con su hash en el nombre).
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// Navegación: cualquier ruta del SPA se sirve con el index precacheado, salvo
// las que no son de la app.
const handler = createHandlerBoundToURL('/index.html')
registerRoute(new NavigationRoute(handler, {
  denylist: [
    /^\/_/,                 // internas de la plataforma
    /\/[^/?]+\.[^/]+$/,     // archivos con extensión (assets, PDFs)
  ],
}))

// Supabase (rest, auth, realtime, storage, functions): SIEMPRE red, nunca
// caché. No hace falta ninguna regla para lograrlo, y por eso no hay una:
// `precacheAndRoute` solo matchea los archivos del propio build y
// `NavigationRoute` solo las navegaciones, así que ningún pedido a
// *.supabase.co llega a tocar el service worker. Un listener de `fetch`
// vacío "por las dudas" sería peor: no haría nada y además obligaría al
// navegador a despertar el SW en cada request.

// Las actualizaciones NO se aplican solas: nada de skipWaiting automático. El
// SW nuevo queda "waiting" y toma el control recién en el próximo arranque en
// frío. La app avisa con un toast discreto (ver registrarSW en main.jsx).
self.addEventListener('message', (event) => {
  // Solo si la app lo pide explícitamente (por ahora no lo pide: queda para
  // un "Actualizar ahora" si alguna vez hace falta).
  if (event.data?.type === 'APLICAR_ACTUALIZACION') self.skipWaiting()
})

// ------------------------------------------------------------------ push

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    datos = { title: 'Prius', body: event.data?.text?.() || '' }
  }

  const opciones = {
    body: datos.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192-maskable.png',
    // `tag` + renotify: un segundo aviso del mismo día reemplaza al anterior
    // en vez de apilarse.
    tag: datos.tag || 'prius',
    renotify: true,
    data: { url: datos.url || '/app/home' },
  }

  event.waitUntil(self.registration.showNotification(datos.title || 'Prius', opciones))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = event.notification.data?.url || '/app/home'

  event.waitUntil((async () => {
    const abiertas = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Si la app ya está abierta, se la enfoca y se navega ahí: abrir una
    // segunda ventana del CRM es confuso y pierde el estado.
    for (const c of abiertas) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus()
        if ('navigate' in c) await c.navigate(destino)
        return
      }
    }
    await clients.openWindow(destino)
  })())
})

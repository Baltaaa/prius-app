// Prefetch del chunk de una ruta (nov 2026, Tarea 6).
//
// Cada pantalla es un React.lazy, así que al tocar un ítem del nav hay un
// viaje a la red antes de ver nada. Acá se dispara ESE import apenas el dedo
// toca (o el mouse pasa por encima) el ítem: cuando se suelta, el chunk ya
// está. Es el mismo `import()` que usa App.jsx, así que el navegador lo
// resuelve de su propia caché de módulos y no hay doble descarga.
//
// Fallar en silencio es lo correcto: si el prefetch no llega, la navegación
// normal lo vuelve a pedir.

const CARGADORES = {
  '/app/home': () => import('../pages/crm/Home'),
  '/app/plano': () => import('../pages/Dashboard'),
  '/app/cabinas-lockers': () => import('../pages/crm/CabinasLockers'),
  '/app/recepcion': () => import('../pages/Recepcion'),
  '/app/reservas': () => import('../pages/crm/Reservas'),
  '/app/clientes': () => import('../pages/crm/Clientes'),
  '/app/caja': () => import('../pages/crm/Caja'),
  '/app/reportes': () => import('../pages/crm/Reportes'),
  '/app/leads': () => import('../pages/crm/Leads'),
  '/app/ocupacion': () => import('../pages/crm/Ocupacion'),
  '/app/historial': () => import('../pages/crm/Actividad'),
  '/app/comprobantes': () => import('../pages/crm/Comprobantes'),
  '/app/notificaciones': () => import('../pages/crm/Notificaciones'),
  '/app/perfil': () => import('../pages/crm/Perfil'),
  '/app/configuracion': () => import('../pages/crm/Configuracion'),
}

const yaPedidas = new Set()

/** Trae el chunk de `ruta` si todavía no se pidió. Nunca tira. */
export function prefetchRuta(ruta) {
  if (!ruta || yaPedidas.has(ruta)) return
  const cargar = CARGADORES[ruta]
  if (!cargar) return
  yaPedidas.add(ruta)
  cargar().catch(() => yaPedidas.delete(ruta))
}

/** Props listas para pegar en un <NavLink>: prefetch al hover y al tocar. */
export function propsPrefetch(ruta) {
  return {
    onMouseEnter: () => prefetchRuta(ruta),
    onTouchStart: () => prefetchRuta(ruta),
    onFocus: () => prefetchRuta(ruta),
  }
}

// Título + subtítulo de cada sección — única fuente, usada por el header de
// página (AppLayout.jsx, título real de la pantalla) y por el subtítulo de
// sección de TopBar.jsx en mobile. Antes vivía solo en TopBar.jsx con
// ícono+color por sección (ese bloque se eliminó del header, oct 2026
// rediseño shell: el header pasa a ser igual en todas las pantallas, el
// título real baja al contenido).
export const SECTION_TITLES = [
  { path: '/app/home', name: 'Dashboard', shortName: 'Inicio', subtitle: 'Resumen de métricas y actividades principales en tiempo real.' },
  { path: '/app/plano', name: 'Plano de Playa', shortName: 'Plano', subtitle: 'Gestión de Unidades Prius Playa Grande' },
  { path: '/app/cabinas-lockers', name: 'Cabinas y Lockers', shortName: 'Cabinas', subtitle: 'Sección en desarrollo — solo lectura.' },
  { path: '/app/reservas', name: 'Cola de Reservas', shortName: 'Reservas', subtitle: 'Alquileres por período y día, ordenados por llegada.' },
  { path: '/app/clientes', name: 'Directorio de Clientes', shortName: 'Clientes', subtitle: 'Historial completo: temporadas y alquileres pasados.' },
  { path: '/app/caja', name: 'Caja Diaria', shortName: 'Caja', subtitle: 'Arqueo, historial y cruce automático con pagos.' },
  { path: '/app/reportes', name: 'Reportes', subtitle: 'Métricas avanzadas de facturación y ocupación.' },
  { path: '/app/leads', name: 'Leads', subtitle: 'Consultas del formulario de la web, en tiempo real.' },
  { path: '/app/historial', name: 'Historial', subtitle: 'Toda acción sobre reservas, pagos, clientes y unidades.' },
  { path: '/app/notificaciones', name: 'Notificaciones', shortName: 'Avisos', subtitle: 'Alertas de sistema, saldos y operaciones diarias.' },
  { path: '/app/comprobantes', name: 'Comprobantes', subtitle: 'Generación de recibos oficiales para clientes.' },
  { path: '/app/perfil', name: 'Perfil y Tarifas', shortName: 'Perfil', subtitle: 'Configuración de cuenta y valores de temporada.' },
  { path: '/app/recepcion', name: 'Recepción', subtitle: 'Check-in de reservas web por QR o código.' },
  { path: '/app/ocupacion', name: 'Ocupación', subtitle: 'Vista semanal y mensual de ocupación por unidad.' },
]

export const DEFAULT_SECTION = { name: 'Balneario Playa Grande', shortName: 'Prius', subtitle: '' }

export function useSection(pathname) {
  return SECTION_TITLES.find((s) => pathname.startsWith(s.path)) || DEFAULT_SECTION
}

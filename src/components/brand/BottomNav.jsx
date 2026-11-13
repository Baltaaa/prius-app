import { APP_VERSION } from '../../lib/appVersion'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { propsPrefetch } from '../../lib/prefetchRutas'
import { useOverlay } from '../../context/OverlayProvider'
import { useNuevaReserva } from '../../context/NuevaReservaProvider'
import {
  Home, Map, Users, MoreHorizontal, X, Wallet, BarChart2, Plus,
  DoorClosed, Inbox, GanttChartSquare, Activity, FileText, UserCheck, Settings, LogOut, QrCode,
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'
import { useMountTransition } from '../../hooks/useMountTransition'
import { CountBadge } from './Badge'
import ScrollFade from '../ui/ScrollFade'
import SelectorTema from './SelectorTema'

// Bottom nav fijo de 5 ítems para mobile (sept 2026) — reemplaza al drawer
// del Sidebar en pantallas chicas (el Sidebar completo queda solo para
// desktop, ver AppLayout.jsx). "Más" abre un bottom sheet con el resto de
// las secciones + Cerrar sesión, para no amontonar más de 5 ítems abajo
// (regla de oro de bottom nav: 3 a 5, nunca más). Botón central "Reserva"
// (oct 2026, mock Stitch; ítem 8 25/10/2026): ya no navega a /app/reservas —
// abre el modal global de Nueva Reserva ahí mismo, en la sección en la que
// está parado el usuario (NuevaReservaProvider, montado en AppLayout).
const ITEMS_IZQ = [
  { name: 'Inicio', path: '/app/home', icon: Home },
  { name: 'Plano', path: '/app/plano', icon: Map },
]
const ITEMS_DER = [
  { name: 'Clientes', path: '/app/clientes', icon: Users },
]

// Volver arriba nativo (Fase 1 mobile, oct 2026): tocar en el BottomNav la
// pestaña que ya está activa scrollea suave al principio de #app-main-scroll
// (mismo contenedor que escuchaba ScrollToTopButton.jsx, ahora solo
// desktop) — patrón estándar de iOS/Android, sin agregar un botón flotante
// que tape contenido en mobile.
function scrollMainToTop() {
  const el = document.getElementById('app-main-scroll')
  if (!el) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)
  const { bind: bindMore } = useOverlay({ id: 'bottomnav-mas', isOpen: showMore, onRequestClose: () => setShowMore(false) })
  const shouldRenderMore = useMountTransition(showMore)
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso } = useAuth()
  const { abrirNuevaReserva } = useNuevaReserva()

  const masItems = [
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(isFeatureEnabled('reportes') && permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    ...(isFeatureEnabled('ocupacion') ? [{ name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare }] : []),
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Mi cuenta', path: '/app/perfil', icon: UserCheck },
    ...(permiso('categorias_gasto') ? [{ name: 'Configuración', path: '/app/configuracion', icon: Settings }] : []),
  ]

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // Resalta "Más" cuando la ruta activa es una de las que vive adentro del
  // sheet (pulido UX, oct 2026, item 5) — mismo criterio de prefijo que ya
  // usa NavLink por default para Inicio/Plano/Clientes.
  const masActivo = masItems.some((item) => location.pathname.startsWith(item.path))

  const claseItem = 'flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[12px] leading-4 font-medium'
  const pill = (activo) => `flex items-center justify-center w-12 h-7 rounded-full anim-colors ${activo ? 'bg-ink text-on-ink' : 'text-ink-2'}`

  const renderItem = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      viewTransition
      {...propsPrefetch(item.path)}
      onClick={() => { if (location.pathname === item.path) scrollMainToTop() }}
      className={({ isActive }) => `${claseItem} ${isActive ? 'text-ink' : 'text-ink-2'}`}
    >
      {({ isActive }) => (
        <>
          <span className={pill(isActive)}><item.icon size={20} strokeWidth={1.5} /></span>
          {item.name}
        </>
      )}
    </NavLink>
  )

  return (
    <>
      <nav
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {ITEMS_IZQ.map(renderItem)}

        {/* Único alta en mobile: dorado para no confundirse con la pill negra
            del activo. El círculo flota con absolute para que el label quede
            en la misma línea que el resto. */}
        <button type="button" onClick={() => abrirNuevaReserva()} className={`relative ${claseItem} text-ink-2`}>
          <span className="w-12 h-7" aria-hidden="true" />
          <span className="absolute -top-4 w-12 h-12 rounded-full bg-gold text-on-gold flex items-center justify-center active:scale-95 transition-transform">
            <Plus size={24} strokeWidth={1.5} />
          </span>
          Reserva
        </button>

        {ITEMS_DER.map(renderItem)}

        <button onClick={() => setShowMore(true)} className={`relative ${claseItem} ${masActivo ? 'text-ink' : 'text-ink-2'}`}>
          <span className={pill(masActivo)}><MoreHorizontal size={20} strokeWidth={1.5} /></span>
          Más
        </button>
      </nav>

      {shouldRenderMore && createPortal(
        <div
          className={`md:hidden fixed inset-0 z-[998] flex items-end bg-overlay backdrop-blur-sm ${showMore ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
          onClick={() => setShowMore(false)}
        >
          <div
            ref={bindMore}
            className={`w-full max-h-[85dvh] capa-elevada bg-card rounded-t-card flex flex-col overflow-hidden ${showMore ? 'ui-open-sheet' : 'ui-close-sheet'}`}
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-line" />
            </div>
            <div className="flex items-center justify-between px-5 py-2 shrink-0">
              <h2 className="text-card-title text-ink">Más secciones</h2>
              <button onClick={() => setShowMore(false)} aria-label="Cerrar" className="btn-icon text-ink-2">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <ScrollFade wrapperClassName="flex-1" className="overflow-y-auto overscroll-contain px-3 pb-4 space-y-1">
              {masItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  viewTransition
      {...propsPrefetch(item.path)}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 px-3 min-h-[48px] rounded-nav text-body anim-colors ${
                      isActive ? 'bg-surface text-ink' : 'text-ink-2 hover:bg-surface'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={20} strokeWidth={1.5} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-full bg-surface text-label text-ink-2">Pronto</span>}
                  {!item.comingSoon && item.badge > 0 && <CountBadge value={item.badge} className="shrink-0" />}
                </NavLink>
              ))}
              <div className="px-3 pt-2 pb-3">
                <p className="section-label">Tema</p>
                <SelectorTema />
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-nav text-body text-danger hover:bg-danger-soft anim-colors"
              >
                <LogOut size={20} strokeWidth={1.5} />
                Cerrar sesión
              </button>
              {/* Footer global en mobile: al final de "Más", no en cada pantalla. */}
              <div className="pt-4 pb-1 flex flex-col items-center gap-1 text-center text-label text-ink-2">
                <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gold" /><span className="text-ink">Prius Playa Grande</span> · Sector Carpas y Balneario</span>
                <span>Mar del Plata · Buenos Aires · {APP_VERSION}</span>
              </div>
            </ScrollFade>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

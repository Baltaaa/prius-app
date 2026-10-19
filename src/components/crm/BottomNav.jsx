import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { useOverlay } from '../../context/OverlayProvider'
import {
  Home, Map, Users, MoreHorizontal, X, Wallet, BarChart2, Plus,
  DoorClosed, Inbox, GanttChartSquare, Activity, FileText, UserCheck, LogOut, QrCode,
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'
import { useMountTransition } from '../../hooks/useMountTransition'

// Bottom nav fijo de 5 ítems para mobile (sept 2026) — reemplaza al drawer
// del Sidebar en pantallas chicas (el Sidebar completo queda solo para
// desktop, ver AppLayout.jsx). "Más" abre un bottom sheet con el resto de
// las secciones + Cerrar sesión, para no amontonar más de 5 ítems abajo
// (regla de oro de bottom nav: 3 a 5, nunca más). Botón central "Reserva"
// (oct 2026, mock Stitch): mismo destino que antes (/app/reservas, única
// pantalla real de alta), solo cambia el look — círculo dorado elevado con
// "+", no una pestaña plana más.
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

  const masItems = [
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(isFeatureEnabled('reportes') && permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    ...(isFeatureEnabled('ocupacion') ? [{ name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare }] : []),
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck },
  ]

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <nav
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-hairline flex items-stretch font-ui"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {ITEMS_IZQ.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (location.pathname === item.path) scrollMainToTop() }}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-label-md transition-colors ${
                isActive ? 'text-black font-semibold' : 'text-prius-slate hover:text-black'
              }`
            }
          >
            <item.icon size={22} />
            {item.name}
          </NavLink>
        ))}

        {/* Botón central elevado "Reserva" (mock) */}
        <NavLink to="/app/reservas" className="flex-1 flex flex-col items-center justify-center -mt-4">
          <span className="w-12 h-12 rounded-full bg-gold flex items-center justify-center shadow-[0_2px_8px_rgba(242,202,80,0.35)] active:scale-95 transition-transform">
            <Plus size={24} className="text-black" />
          </span>
          <span className="text-label-md text-black mt-1">Reserva</span>
        </NavLink>

        {ITEMS_DER.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (location.pathname === item.path) scrollMainToTop() }}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-label-md transition-colors ${
                isActive ? 'text-black font-semibold' : 'text-prius-slate hover:text-black'
              }`
            }
          >
            <item.icon size={22} />
            {item.name}
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-label-md text-prius-slate hover:text-black transition-colors"
        >
          <MoreHorizontal size={22} />
          Más
        </button>
      </nav>

      {shouldRenderMore && createPortal(
        <div
          className={`md:hidden fixed inset-0 z-[998] flex items-end bg-black/70 backdrop-blur-md ${showMore ? 'ui-backdrop-open' : 'ui-backdrop-close'}`}
          onClick={() => setShowMore(false)}
        >
          <div
            ref={bindMore}
            className={`w-full max-h-[85vh] bg-white border-t border-hairline rounded-t-3xl flex flex-col overflow-hidden ${showMore ? 'ui-open-sheet' : 'ui-close-sheet'}`}
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-prius-subtle" />
            </div>
            <div className="flex items-center justify-between px-6 py-3 shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-black">Más secciones</h2>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-prius-subtle rounded-lg text-prius-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {masItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 px-3 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-prius-subtle text-gold' : 'text-prius-slate hover:bg-prius-subtle'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-prius-subtle text-prius-slate rounded uppercase tracking-wider">Pronto</span>
                  )}
                  {!item.comingSoon && item.badge > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-gold text-black rounded-full">{item.badge}</span>
                  )}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-sm font-medium text-prius-error hover:bg-red-400/10 transition-all"
              >
                <LogOut size={18} />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

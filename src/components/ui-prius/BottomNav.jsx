import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { useOverlay } from '../../context/OverlayProvider'
import {
  Home, Map, CalendarDays, Users, MoreHorizontal, X, Wallet, BarChart2,
  DoorClosed, Inbox, GanttChartSquare, Activity, Bell, FileText, UserCheck, LogOut, QrCode,
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'

// BottomNav "Playa Privada": mismos 5 ítems y mismo mecanismo que
// crm/BottomNav.jsx (scroll-to-top al re-tocar activo, overlay manager para
// "Más"), look claro — fondo blanco, borde superior hairline, activo con
// línea dorada de 3px debajo del ícono en vez de color de texto.
const ITEMS = [
  { name: 'Inicio', path: '/app/home', icon: Home },
  { name: 'Plano', path: '/app/plano', icon: Map },
  { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
  { name: 'Clientes', path: '/app/clientes', icon: Users },
]

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
  const { bind: bindMore } = useOverlay({ id: 'prius-bottomnav-mas', isOpen: showMore, onRequestClose: () => setShowMore(false) })
  const { countPendientes, countNovedadesNoLeidas } = useNotificaciones()
  const notificationsCount = countPendientes + countNovedadesNoLeidas
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso } = useAuth()

  const masItems = [
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    { name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare },
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
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
        {ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (location.pathname === item.path) scrollMainToTop() }}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-label-md uppercase ${
                isActive ? 'text-black' : 'text-prius-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-gold" />}
                <item.icon size={20} />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-label-md uppercase text-prius-muted"
        >
          <span className="relative">
            <MoreHorizontal size={20} />
            {notificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-gold text-black text-[10px] font-bold flex items-center justify-center">
                {notificationsCount > 9 ? '9+' : notificationsCount}
              </span>
            )}
          </span>
          Más
        </button>
      </nav>

      {showMore && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[998] flex items-end bg-black/40 animate-in fade-in duration-200"
          onClick={() => setShowMore(false)}
        >
          <div
            ref={bindMore}
            className="w-full max-h-[85vh] bg-white border-t border-hairline rounded-t-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 font-ui"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-hairline" />
            </div>
            <div className="flex items-center justify-between px-6 py-3 shrink-0">
              <h2 className="text-label-lg uppercase text-black">Más secciones</h2>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-prius-subtle rounded-xl text-prius-slate"
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
                    `flex items-center justify-between gap-3 px-3 py-3 min-h-[44px] rounded-xl text-body-md font-medium ${
                      isActive ? 'bg-prius-subtle text-black border border-gold' : 'text-prius-slate hover:bg-prius-subtle'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-prius-subtle text-prius-muted rounded uppercase tracking-wider border border-hairline">Pronto</span>
                  )}
                  {!item.comingSoon && item.badge > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-gold text-black rounded-full">{item.badge}</span>
                  )}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-body-md font-medium text-prius-error hover:bg-prius-error/10"
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

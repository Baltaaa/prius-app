import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { useLeads } from '../../hooks/useLeads'
import {
  Home, Map, CalendarDays, Users, MoreHorizontal, X, Wallet, BarChart2,
  DoorClosed, Inbox, GanttChartSquare, Activity, Bell, FileText, UserCheck, LogOut,
} from 'lucide-react'

// Bottom nav fijo de 5 ítems para mobile (sept 2026) — reemplaza al drawer
// del Sidebar en pantallas chicas (el Sidebar completo queda solo para
// desktop, ver AppLayout.jsx). "Más" abre un bottom sheet con el resto de
// las secciones + Cerrar sesión, para no amontonar más de 5 ítems abajo
// (regla de oro de bottom nav: 3 a 5, nunca más).
const ITEMS = [
  { name: 'Inicio', path: '/app/home', icon: Home },
  { name: 'Plano', path: '/app/plano', icon: Map },
  { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
  { name: 'Clientes', path: '/app/clientes', icon: Users },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const { count: notificationsCount } = useNotifications()
  const { sinContactar: leadsSinContactar } = useLeads()

  const masItems = [
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart2 },
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    { name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare },
    { name: 'Línea de Tiempo', path: '/app/actividad', icon: Activity },
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <>
      <nav
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0d14] border-t border-white/10 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[9px] font-bold uppercase tracking-wider transition-all ${
                isActive ? 'text-[#FDE047]' : 'text-gray-500'
              }`
            }
          >
            <item.icon size={20} />
            {item.name}
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[9px] font-bold uppercase tracking-wider text-gray-500 transition-all"
        >
          <MoreHorizontal size={20} />
          Más
        </button>
      </nav>

      {showMore && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[998] flex items-end bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowMore(false)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#0a0d14] border-t border-white/10 rounded-t-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-6 py-3 shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">Más secciones</h2>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg text-white/50"
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
                      isActive ? 'bg-white/10 text-[#FDE047]' : 'text-gray-300 hover:bg-white/5'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold bg-white/10 text-gray-400 rounded uppercase tracking-wider">Pronto</span>
                  )}
                  {!item.comingSoon && item.badge > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-[#FDE047] text-black rounded-full">{item.badge}</span>
                  )}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all"
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

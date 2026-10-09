import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wallet,
  BarChart2,
  Map,
  LogOut,
  Bell,
  FileText,
  UserCheck,
  Activity,
  Inbox,
  GanttChartSquare,
  DoorClosed,
  QrCode
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'

// Mobile-first (sept 2026): en pantallas chicas la navegación vive en
// BottomNav.jsx (5 ítems + "Más") — este Sidebar queda oculto por completo
// (hidden md:flex) en vez de convertirse en drawer, para no duplicar la
// misma navegación de dos formas distintas en mobile.
export default function Sidebar() {
  const navigate = useNavigate()
  const { count: notificationsCount } = useNotifications()
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const mainNav = [
    { name: 'Dashboard', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano de Playa', path: '/app/plano', icon: Map },
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
  ]

  const additionalNav = [
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    { name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare },
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck }
  ]

  return (
    <aside className="no-print hidden md:flex w-64 h-screen bg-[#0a0d14] border-r border-white/10 flex-col justify-between shrink-0 sticky top-0 left-0 z-30">
      <div className="flex flex-col overflow-hidden">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-4 border-b border-white/5 gap-2">
          <div className="text-[#FDE047] text-3xl font-bold italic shrink-0">
            <img src="/images/prius-icon.png" alt="P" className="w-8 h-8 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-[16px] text-white tracking-tight leading-none whitespace-nowrap">Prius Playa Grande</h1>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-1">PriusApp</p>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          <div>
            <h2 className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">
              Gestión Operativa
            </h2>
            <nav className="space-y-1">
              {mainNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white/10 text-[#FDE047] border-l-2 border-[#FDE047]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold bg-white/10 text-gray-400 rounded uppercase tracking-wider">
                      Pronto
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">
              Módulos Adicionales
            </h2>
            <nav className="space-y-1">
              {additionalNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-white/10 text-[#FDE047] border-l-2 border-[#FDE047]' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#FDE047] text-black rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors text-left"
        >
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
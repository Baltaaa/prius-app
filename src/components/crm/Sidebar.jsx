import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Wallet, 
  BarChart2, 
  Map, 
  LogOut,
  Calendar,
  Bell,
  FileText,
  UserCheck
} from 'lucide-react'

export default function Sidebar({ notificationsCount = 0 }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const mainNav = [
    { name: 'Dashboard', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano de Playa', path: '/app/plano', icon: Map },
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart2 }
  ]

  const newNav = [
    { name: 'Calendario', path: '/app/calendario', icon: Calendar },
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck }
  ]

  return (
    <aside className="w-64 h-screen bg-white border-r border-[#E5E5E5] flex flex-col justify-between shrink-0 hidden md:flex sticky top-0 left-0 z-30">
      <div className="flex flex-col overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#E5E5E5] gap-3">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center font-bold text-[#F2CA50] text-sm">
            P
          </div>
          <div>
            <h1 className="font-bold text-sm text-black tracking-tight leading-none">PriusAdmin</h1>
            <p className="text-[10px] text-neutral-500 font-medium tracking-wide uppercase mt-0.5">Playa Grande</p>
          </div>
        </div>

        {/* Main Nav Section */}
        <div className="p-4 space-y-6">
          <div>
            <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Gestión Operativa
            </p>
            <nav className="space-y-1">
              {mainNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2.5 rounded text-xs font-semibold transition-colors
                    ${isActive 
                      ? 'bg-black text-[#F2CA50]' 
                      : 'text-neutral-700 hover:bg-[#E5E5E5]/50 hover:text-black'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className="shrink-0" />
                    <span>{item.name}</span>
                  </div>
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Módulos Adicionales
            </p>
            <nav className="space-y-1">
              {newNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2.5 rounded text-xs font-semibold transition-colors
                    ${isActive 
                      ? 'bg-black text-[#F2CA50]' 
                      : 'text-neutral-700 hover:bg-[#E5E5E5]/50 hover:text-black'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className="shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#F2CA50] text-black rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* User / Signout Footer */}
      <div className="p-4 border-t border-[#E5E5E5]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-red-50 hover:text-red-600 rounded transition-colors text-left"
        >
          <LogOut size={16} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
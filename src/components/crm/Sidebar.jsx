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

export default function Sidebar({ notificationsCount = 1 }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const mainNav = [
    { name: 'Dashboard', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano de Playa', path: '/app/plano', icon: Map },
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart2 }
  ]

  const additionalNav = [
    { name: 'Calendario', path: '/app/calendario', icon: Calendar },
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck }
  ]

  return (
    <aside className="w-64 h-screen bg-[#0a0d14] border-r border-white/10 flex flex-col justify-between shrink-0 hidden md:flex sticky top-0 left-0 z-30">
      <div className="flex flex-col overflow-hidden">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 gap-3">
          <div className="text-[#FDE047] text-3xl font-bold italic shrink-0">
            <img src="/images/prius-icon.png" alt="P" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight leading-none">Prius</h1>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-1">PriusAdmin</p>
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
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-white/10 text-[#FDE047] border-l-2 border-[#FDE047]' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span>{item.name}</span>
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
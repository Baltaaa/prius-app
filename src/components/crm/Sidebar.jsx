import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotifications } from '../../hooks/useNotifications'
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
  UserCheck,
  X
} from 'lucide-react'

export default function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const navigate = useNavigate()
  const { count: notificationsCount } = useNotifications()

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
    <>
      {/* Backdrop del drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`w-64 h-screen bg-[#0a0d14] border-r border-white/10 flex flex-col justify-between shrink-0
          fixed md:sticky top-0 left-0 z-40 md:z-30 transition-transform duration-300 md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
      <div className="flex flex-col overflow-hidden">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 gap-3">
          <div className="text-[#FDE047] text-3xl font-bold italic shrink-0">
            <img src="/images/prius-icon.png" alt="P" className="w-8 h-8 object-contain" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-white tracking-tight leading-none">Prius</h1>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-1">PriusAdmin</p>
          </div>
          <button onClick={onCloseMobile} className="md:hidden p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
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
                  onClick={onCloseMobile}
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
                  onClick={onCloseMobile}
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
    </>
  )
}
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
  LogOut 
} from 'lucide-react'

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const navItems = [
    { name: 'Inicio', path: '/app/home', icon: LayoutDashboard },
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart2 },
    { name: 'Plano Playa', path: '/dashboard', icon: Map }
  ]

  return (
    <aside className="w-[220px] h-screen bg-[#E5E5E5] text-black flex flex-col justify-between shrink-0 hidden md:flex border-r border-[#CCCCCC]">
      {/* Top Brand area */}
      <div className="flex flex-col">
        <div className="h-20 bg-black flex items-center px-6">
          <span className="text-[#F2CA50] font-bold text-lg uppercase tracking-widest font-display">PRIUS APP</span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-wider font-semibold transition-all
                ${isActive 
                  ? 'bg-[#F2CA50] text-black font-bold' 
                  : 'text-black/80 hover:bg-black/5 hover:text-black'
                }
              `}
            >
              <item.icon size={16} />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout button */}
      <div className="p-4 border-t border-black/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-wider font-semibold text-black/70 hover:bg-red-50 hover:text-red-600 transition-all text-left"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
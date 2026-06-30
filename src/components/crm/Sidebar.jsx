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
    { name: 'Plano Playa', path: '/app/plano', icon: Map },
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart2 }
  ]

  return (
    <aside className="w-[220px] h-screen bg-black text-white flex flex-col justify-between shrink-0 hidden md:flex border-r border-neutral-900">
      <div className="flex flex-col">
        {/* Brand logo space with Prius brand color */}
        <div className="h-20 bg-black flex flex-col justify-center px-6 border-b border-neutral-900">
          <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-neutral-500 leading-none mb-1">PLAYA GRANDE</span>
          <span className="text-[#F2CA50] font-extrabold text-sm uppercase tracking-widest font-display leading-none">PRIUS APP</span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 text-[10px] uppercase tracking-wider font-bold transition-all
                ${isActive 
                  ? 'bg-neutral-900 text-[#F2CA50] border-l-2 border-[#F2CA50]' 
                  : 'text-neutral-400 hover:bg-neutral-900/60 hover:text-white'
                }
              `}
            >
              <item.icon size={14} className="shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout option */}
      <div className="p-4 border-t border-neutral-900">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-neutral-500 hover:bg-red-950/20 hover:text-red-400 transition-all text-left"
        >
          <LogOut size={14} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
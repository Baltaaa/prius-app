import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Wallet, 
  Map 
} from 'lucide-react'

export default function BottomNav() {
  const tabs = [
    { name: 'Inicio', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano', path: '/app/plano', icon: Map },
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja', path: '/app/caja', icon: Wallet }
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-black border-t border-neutral-900 flex justify-around items-center z-50">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-full h-full text-[9px] uppercase font-bold tracking-widest transition-colors
            ${isActive ? 'text-[#F2CA50]' : 'text-neutral-500'}
          `}
        >
          <tab.icon size={18} className="mb-0.5" />
          <span>{tab.name}</span>
        </NavLink>
      ))}
    </nav>
  )
}
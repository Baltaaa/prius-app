import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Wallet, 
  BarChart2 
} from 'lucide-react'

export default function BottomNav() {
  const tabs = [
    { name: 'Inicio', path: '/app/home', icon: LayoutDashboard },
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja', path: '/app/caja', icon: Wallet },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart2 }
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-[#E5E5E5] flex justify-around items-center z-50">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-full h-full text-[10px] uppercase font-bold tracking-tight transition-colors
            ${isActive ? 'text-[#F2CA50]' : 'text-neutral-500'}
          `}
        >
          <tab.icon size={20} className="mb-0.5" />
          <span>{tab.name}</span>
        </NavLink>
      ))}
    </nav>
  )
}
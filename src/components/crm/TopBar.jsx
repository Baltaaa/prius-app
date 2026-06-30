import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LogOut, Map } from 'lucide-react'

export default function TopBar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-black text-white border-b border-neutral-900 flex items-center justify-between px-4 z-50">
      <div className="flex flex-col">
        <span className="text-[8px] font-bold tracking-[0.3em] text-neutral-500 leading-none">PLAYA GRANDE</span>
        <span className="text-[#F2CA50] font-extrabold text-xs tracking-widest font-display leading-none mt-1">PRIUS APP</span>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/app/plano')}
          className="p-2 text-white hover:text-[#F2CA50] flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
          title="Ver Plano Playa"
        >
          <Map size={16} />
          <span>Plano</span>
        </button>
        <button
          onClick={handleLogout}
          className="p-2 text-neutral-400 hover:text-red-400"
          title="Cerrar Sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
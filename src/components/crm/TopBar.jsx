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
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-black text-white border-b border-[#E5E5E5] flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-2">
        <span className="text-[#F2CA50] font-bold text-sm tracking-widest font-display">PRIUS APP</span>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/app/plano')}
          className="p-2 text-white hover:text-[#F2CA50] flex items-center gap-1 text-xs font-bold"
          title="Ver Plano Playa"
        >
          <Map size={18} />
          <span>Plano</span>
        </button>
        <button
          onClick={handleLogout}
          className="p-2 text-white hover:text-red-400"
          title="Cerrar Sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
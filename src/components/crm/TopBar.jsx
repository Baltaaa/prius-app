import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Search, Bell, User, LogOut, ChevronDown, Menu, Map } from 'lucide-react'

export default function TopBar({ onToggleMobileMenu }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [userEmail, setUserEmail] = useState('Admin')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      navigate(`/app/reservas?q=${encodeURIComponent(searchValue)}`)
    }
  }

  // Generate breadcrumb from current route
  const getBreadcrumbs = () => {
    const path = location.pathname.split('/').filter(Boolean)
    const currentSegment = path[path.length - 1] || 'home'
    const routeNames = {
      home: 'Dashboard',
      plano: 'Plano de Playa',
      reservas: 'Reservas',
      clientes: 'Clientes',
      caja: 'Caja Diaria',
      reportes: 'Reportes',
      calendario: 'Calendario',
      notificaciones: 'Notificaciones',
      comprobantes: 'Comprobantes',
      perfil: 'Perfil y Tarifas'
    }
    return {
      title: routeNames[currentSegment] || 'Dashboard',
      path: `PriusAdmin / ${routeNames[currentSegment] || 'Home'}`
    }
  }

  const breadcrumb = getBreadcrumbs()

  return (
    <header className="h-16 bg-white border-b border-[#E5E5E5] sticky top-0 z-20 flex items-center justify-between px-4 md:px-8">
      {/* Mobile Menu Button & Title */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-neutral-700 hover:bg-[#E5E5E5] rounded"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className="text-sm font-bold text-black tracking-tight">{breadcrumb.title}</h2>
          <p className="text-[10px] text-neutral-400 font-medium hidden sm:block">{breadcrumb.path}</p>
        </div>
      </div>

      {/* Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-72">
        <Search size={15} className="absolute left-3 text-neutral-400" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Buscar reservas, clientes..."
          className="w-full pl-9 pr-3 py-1.5 bg-[#F9F9F9] border border-[#E5E5E5] focus:border-black outline-none text-xs rounded"
        />
      </form>

      {/* Right Controls: Notification Bell + User Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
            className="p-2 text-neutral-600 hover:bg-[#E5E5E5] rounded-full relative"
            title="Centro de Alertas"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#F2CA50] rounded-full ring-2 ring-white" />
          </button>

          {showNotificationsMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E5E5E5] rounded shadow-none z-50 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                <span className="text-xs font-bold uppercase">Notificaciones</span>
                <button 
                  onClick={() => navigate('/app/notificaciones')} 
                  className="text-[10px] text-[#000000] font-semibold underline"
                >
                  Ver todas
                </button>
              </div>
              <div className="text-xs space-y-2 py-1">
                <div 
                  onClick={() => { navigate('/app/notificaciones'); setShowNotificationsMenu(false); }}
                  className="p-2 hover:bg-[#F9F9F9] cursor-pointer rounded border-l-2 border-[#F2CA50]"
                >
                  <p className="font-semibold text-black text-[11px]">Reservas con saldo pendiente</p>
                  <p className="text-[10px] text-neutral-500">Haz clic para revisar cuentas corrientes.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 hover:bg-[#F9F9F9] rounded border border-transparent hover:border-[#E5E5E5] transition-colors"
          >
            <div className="w-7 h-7 bg-black text-[#F2CA50] rounded flex items-center justify-center font-bold text-xs">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-black hidden sm:block max-w-[120px] truncate">
              {userEmail}
            </span>
            <ChevronDown size={14} className="text-neutral-500" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E5E5E5] rounded z-50 py-1">
              <div className="px-3 py-2 border-b border-[#E5E5E5]">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Administrador</p>
                <p className="text-xs font-medium text-black truncate">{userEmail}</p>
              </div>
              <button
                onClick={() => { navigate('/app/perfil'); setShowProfileMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-[#E5E5E5]/50 flex items-center gap-2 font-medium"
              >
                <User size={14} />
                <span>Perfil y Configuración</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium border-t border-[#E5E5E5]"
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
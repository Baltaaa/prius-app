import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Search, Bell, User, LogOut, ChevronDown, Menu, Wallet, Calendar, AlertCircle } from 'lucide-react'

const NOTIF_ICON = { caja: Wallet, checkin: Calendar, saldo: AlertCircle }

export default function TopBar({ onToggleMobileMenu }) {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('Admin')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { items: notifItems, count: notifCount } = useNotifications()

  useEffect(() => {
    // getSession lee de localStorage (sin red); getUser hacía un request en cada montaje
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-white hover:bg-white/5 rounded-lg border border-white/10"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold tracking-widest text-gray-400 uppercase hidden sm:inline-block">
          Balneario Playa Grande
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search"
            className="w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm rounded-lg text-white placeholder-gray-500 transition-all"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications((v) => !v); setShowProfileMenu(false) }}
            className="text-gray-400 hover:text-white relative p-2 rounded-lg hover:bg-white/5 transition-all"
          >
            <Bell size={20} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#FDE047] rounded-full border-2 border-[#0a0d14]" />
            )}
          </button>

          {showNotifications && (
            <>
              {/* Backdrop: cierra el panel al tocar afuera (clave en mobile) */}
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-3 w-80 max-w-[90vw] glass-card rounded-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Notificaciones</p>
                  {notifCount > 0 && (
                    <span className="text-[10px] font-bold text-black bg-[#FDE047] rounded-full px-2 py-0.5">{notifCount}</span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {notifItems.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-gray-500">Sin novedades por ahora.</p>
                  ) : (
                    notifItems.slice(0, 5).map((item) => {
                      const Icon = NOTIF_ICON[item.type] || Bell
                      return (
                        <div key={item.id} className="px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-all">
                          <Icon size={16} className="text-[#FDE047] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.titulo}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{item.detalle}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <button
                  onClick={() => { navigate('/app/notificaciones'); setShowNotifications(false) }}
                  className="w-full text-center px-4 py-3 text-[10px] font-bold text-[#FDE047] uppercase tracking-widest hover:bg-white/5 transition-all border-t border-white/10"
                >
                  Ver todas
                </button>
              </div>
            </>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false) }}
            className="flex items-center gap-3 p-1 hover:bg-white/5 rounded-lg transition-all"
          >
            <div className="w-8 h-8 bg-[#FDE047] text-black rounded flex items-center justify-center font-bold text-sm">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-white hidden sm:block">
              {userEmail.split('@')[0]}
            </span>
            <ChevronDown size={14} className="text-gray-500" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 glass-card rounded-xl overflow-hidden z-50 p-1">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Administrador</p>
                <p className="text-xs font-medium text-white truncate">{userEmail}</p>
              </div>
              <button
                onClick={() => { navigate('/app/perfil'); setShowProfileMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2 rounded-lg"
              >
                <User size={14} /> Perfil
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-400/10 flex items-center gap-2 rounded-lg"
              >
                <LogOut size={14} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
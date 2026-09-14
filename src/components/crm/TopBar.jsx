import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { useData } from '../../context/DataProvider'
import { useDebounced } from '../../hooks/useDebounced'
import { Search, Bell, User, LogOut, ChevronDown, Menu, Wallet, Calendar, AlertCircle } from 'lucide-react'
import StatusBadge from './StatusBadge'

const NOTIF_ICON = { caja: Wallet, checkin: Calendar, saldo: AlertCircle }

// Normaliza para comparar sin importar mayúsculas/acentos (ej: "Perez" matchea "Pérez").
const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export default function TopBar({ onToggleMobileMenu }) {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('Admin')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { items: notifItems, count: notifCount } = useNotifications()
  const { clientes, reservas } = useData()

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

  // Búsqueda global: client-side sobre los datos ya en DataProvider (sin
  // round-trip a Supabase). Debounce de 200ms para no re-filtrar en cada
  // tecla; el dato ya está en memoria, esto solo evita renders de más.
  const debouncedSearch = useDebounced(searchValue, 200)
  const term = useMemo(() => normalize(debouncedSearch).trim(), [debouncedSearch])

  const clienteMatches = useMemo(() => {
    if (!term) return []
    return clientes
      .filter((c) => normalize(c.nombre).includes(term) || (c.telefono && normalize(c.telefono).includes(term)))
      .slice(0, 5)
  }, [clientes, term])

  const reservaMatches = useMemo(() => {
    if (!term) return []
    return reservas
      .filter((r) => {
        const nombre = r.clientes?.nombre
        const telefono = r.clientes?.telefono
        return (nombre && normalize(nombre).includes(term)) || (telefono && normalize(telefono).includes(term))
      })
      .slice(0, 5)
  }, [reservas, term])

  const showDropdown = searchValue.trim().length > 0
  const closeSearch = () => setSearchValue('')

  const goToCliente = (cliente) => {
    navigate(`/app/clientes?id=${cliente.id}`)
    closeSearch()
  }

  const goToReserva = (reserva) => {
    navigate(`/app/reservas?id=${reserva.id}`)
    closeSearch()
  }

  return (
    <header className="h-20 flex items-center gap-3 px-4 sm:px-6 md:px-8 border-b border-white/5 sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-4 shrink-0">
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

      {/* Búsqueda global: visible en todos los breakpoints */}
      <div className="relative flex-1 min-w-0 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Buscar cliente o reserva..."
          className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm rounded-lg text-white placeholder-gray-500 transition-all"
        />

        {showDropdown && (
          <>
            {/* Backdrop: cierra el dropdown al tocar afuera (clave en mobile) */}
            <div className="fixed inset-0 z-40" onClick={closeSearch} />
            <div className="absolute left-0 right-0 mt-2 glass-popover rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto">
              {clienteMatches.length === 0 && reservaMatches.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500">Sin resultados para "{searchValue}"</p>
              ) : (
                <>
                  {clienteMatches.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Clientes</p>
                      {clienteMatches.map((cliente) => (
                        <button
                          key={cliente.id}
                          onClick={() => goToCliente(cliente)}
                          className="w-full text-left px-4 py-2.5 hover:bg-white/10 transition-colors"
                        >
                          <p className="text-xs font-bold text-white truncate">{cliente.nombre}</p>
                          {cliente.telefono && <p className="text-[11px] text-gray-500">{cliente.telefono}</p>}
                        </button>
                      ))}
                    </div>
                  )}

                  {reservaMatches.length > 0 && (
                    <div className={clienteMatches.length > 0 ? 'border-t border-white/10' : ''}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reservas</p>
                      {reservaMatches.map((reserva) => (
                        <button
                          key={reserva.id}
                          onClick={() => goToReserva(reserva)}
                          className="w-full text-left px-4 py-2.5 hover:bg-white/10 transition-colors flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-white truncate">{reserva.clientes?.nombre || 'S/N'}</span>
                            <span className="block text-[11px] text-gray-500 uppercase truncate">
                              {reserva.unidades?.tipo} #{reserva.unidades?.numero}
                            </span>
                          </span>
                          <StatusBadge status={reserva.estado_pago} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
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
              <div className="absolute right-0 mt-3 w-80 max-w-[90vw] glass-popover rounded-xl overflow-hidden z-50">
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
            <div className="absolute right-0 mt-3 w-56 glass-popover rounded-xl overflow-hidden z-50 p-1">
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

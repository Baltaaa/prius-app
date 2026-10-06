import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { useData } from '../../context/DataProvider'
import { useAuth } from '../../context/AuthProvider'
import { useDebounced } from '../../hooks/useDebounced'
import { unidadEmoji, normalizeText } from '../../lib/format'
import { parseDNI, parseUnidadQuery } from '../../lib/parse'
import { estadoBadgeStatus } from '../../lib/reservas'
import { linkToCliente, linkToReserva, linkToPlano } from '../../lib/deepLinks'
import SearchInput from '../inputs/SearchInput'
import {
  Search, Bell, User, LogOut, ChevronDown, X, Wallet, Calendar, AlertCircle,
  LayoutDashboard, Map, CalendarClock, Users, BarChart2, Inbox,
  Activity, FileText, UserCheck, DoorClosed,
} from 'lucide-react'
import StatusBadge from './StatusBadge'

const NOTIF_ICON = { caja: Wallet, checkin: Calendar, saldo: AlertCircle }

// Título + subtítulo + ícono de cada sección, unificados acá (antes vivían
// duplicados: sidebar, este label chico, y de nuevo como bloque grande en
// cada página). Sincronizado con las rutas del Sidebar (mismo listado que
// mainNav + additionalNav en Sidebar.jsx). Los subtítulos son el texto que
// antes estaba debajo del <h1> grande de cada página.
const SECTION_TITLES = [
  {
    path: '/app/home', name: 'Dashboard', subtitle: 'Resumen de métricas y actividades principales en tiempo real.',
    icon: LayoutDashboard, iconBg: 'bg-[#FDE047]/10', iconBorder: 'border-[#FDE047]/20', iconColor: 'text-[#FDE047]',
  },
  {
    path: '/app/plano', name: 'Plano de Playa', subtitle: 'Gestión de Unidades Prius Playa Grande',
    icon: Map, iconBg: 'bg-sky-400/10', iconBorder: 'border-sky-400/20', iconColor: 'text-sky-400',
  },
  {
    path: '/app/cabinas-lockers', name: 'Cabinas y Lockers', subtitle: 'Sección en desarrollo — solo lectura.',
    icon: DoorClosed, iconBg: 'bg-white/10', iconBorder: 'border-white/20', iconColor: 'text-gray-300',
  },
  {
    path: '/app/reservas', name: 'Cola de Reservas', subtitle: 'Alquileres por período y día, ordenados por llegada.',
    icon: CalendarClock, iconBg: 'bg-[#FDE047]/10', iconBorder: 'border-[#FDE047]/20', iconColor: 'text-[#FDE047]',
  },
  {
    path: '/app/clientes', name: 'Directorio de Clientes', subtitle: 'Historial completo: temporadas y alquileres pasados.',
    icon: Users, iconBg: 'bg-cyan-400/10', iconBorder: 'border-cyan-400/20', iconColor: 'text-cyan-400',
  },
  {
    path: '/app/caja', name: 'Caja Diaria', subtitle: 'Arqueo, historial y cruce automático con pagos.',
    icon: Wallet, iconBg: 'bg-green-400/10', iconBorder: 'border-green-400/20', iconColor: 'text-green-400',
  },
  {
    path: '/app/reportes', name: 'Reportes', subtitle: 'Métricas avanzadas de facturación y ocupación.',
    icon: BarChart2, iconBg: 'bg-purple-400/10', iconBorder: 'border-purple-400/20', iconColor: 'text-purple-400',
  },
  {
    path: '/app/leads', name: 'Leads', subtitle: 'Consultas del formulario de la web, en tiempo real.',
    icon: Inbox, iconBg: 'bg-orange-400/10', iconBorder: 'border-orange-400/20', iconColor: 'text-orange-400',
  },
  {
    path: '/app/actividad', name: 'Línea de Tiempo', subtitle: 'Toda acción sobre reservas, pagos, clientes y unidades.',
    icon: Activity, iconBg: 'bg-teal-400/10', iconBorder: 'border-teal-400/20', iconColor: 'text-teal-400',
  },
  {
    path: '/app/notificaciones', name: 'Notificaciones', subtitle: 'Alertas de sistema, saldos y operaciones diarias.',
    icon: Bell, iconBg: 'bg-amber-400/10', iconBorder: 'border-amber-400/20', iconColor: 'text-amber-400',
  },
  {
    path: '/app/comprobantes', name: 'Comprobantes', subtitle: 'Generación de recibos oficiales para clientes.',
    icon: FileText, iconBg: 'bg-violet-400/10', iconBorder: 'border-violet-400/20', iconColor: 'text-violet-400',
  },
  {
    path: '/app/perfil', name: 'Perfil y Tarifas', subtitle: 'Configuración de cuenta y valores de temporada.',
    icon: UserCheck, iconBg: 'bg-pink-400/10', iconBorder: 'border-pink-400/20', iconColor: 'text-pink-400',
  },
]

const DEFAULT_SECTION = { name: 'Balneario Playa Grande', subtitle: '', icon: LayoutDashboard, iconBg: 'bg-white/5', iconBorder: 'border-white/10', iconColor: 'text-gray-400' }

function useSection(pathname) {
  return SECTION_TITLES.find((s) => pathname.startsWith(s.path)) || DEFAULT_SECTION
}

const normalize = normalizeText

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = useSection(location.pathname)
  const SectionIcon = section.icon
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  // Mobile (Tarea 4.2): el buscador inline de desktop pasa a un ícono que
  // abre una búsqueda a pantalla completa, para no competir por espacio con
  // título/avatar en 360px.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { items: notifItems, count: notifCount } = useNotifications()
  const { clientes, reservas } = useData()
  const { perfil, rol, signOut } = useAuth()

  const nombreMostrado = perfil?.nombre || perfil?.usuario || 'Usuario'
  const rolLabel = rol === 'superadmin' ? 'Superadmin' : rol === 'admin' ? 'Admin' : ''

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // Búsqueda global: client-side sobre los datos ya en DataProvider (sin
  // round-trip a Supabase). Debounce de 250ms y mínimo 2 caracteres antes de
  // filtrar — el dato ya está en memoria, esto solo evita renders de más en
  // cada tecla. Busca por nombre, apellido, teléfono, DNI (con o sin puntos)
  // y, en reservas, también por número de unidad ("19", "carpa 19", "c.19").
  const debouncedSearch = useDebounced(searchValue, 250)
  const term = useMemo(() => normalize(debouncedSearch).trim(), [debouncedSearch])
  const dniTerm = useMemo(() => parseDNI(debouncedSearch), [debouncedSearch])
  const unidadQuery = useMemo(() => parseUnidadQuery(debouncedSearch.trim()), [debouncedSearch])
  const activo = term.length >= 2 || (dniTerm.length >= 7) || !!unidadQuery

  const clienteMatches = useMemo(() => {
    if (!activo) return []
    return clientes
      .filter((c) => {
        if (term.length >= 2) {
          if (normalize(c.nombre).includes(term)) return true
          if (c.apellido && normalize(c.apellido).includes(term)) return true
          if (c.telefono && normalize(c.telefono).includes(term)) return true
        }
        if (dniTerm.length >= 7 && c.dni && c.dni.includes(dniTerm)) return true
        return false
      })
      .slice(0, 5)
  }, [clientes, term, dniTerm, activo])

  const reservaMatches = useMemo(() => {
    if (!activo) return []
    return reservas
      .filter((r) => {
        const nombre = r.clientes?.nombre
        const telefono = r.clientes?.telefono
        if (term.length >= 2) {
          if (nombre && normalize(nombre).includes(term)) return true
          if (telefono && normalize(telefono).includes(term)) return true
        }
        if (unidadQuery && r.unidades?.numero === unidadQuery.numero) {
          if (!unidadQuery.tipo || r.unidades?.tipo === unidadQuery.tipo) return true
        }
        return false
      })
      .slice(0, 5)
  }, [reservas, term, unidadQuery, activo])

  const showDropdown = searchValue.trim().length > 0
  const closeSearch = () => setSearchValue('')

  const goToCliente = (cliente) => {
    navigate(linkToCliente(cliente.id))
    closeSearch()
  }

  const goToReserva = (reserva) => {
    navigate(linkToReserva(reserva.id))
    closeSearch()
  }

  return (
    <header className="no-print relative h-20 flex items-center gap-3 px-4 sm:px-6 md:px-8 border-b border-white/5 sticky top-0 z-20 shrink-0">
      {/* Ancho fijo: el título de sección cambia de largo (Dashboard vs
          Perfil y Tarifas) pero no puede correr la barra de búsqueda, que se
          centra contra el nav completo (ver div absoluto más abajo), no
          contra este espacio. Título + subtítulo + ícono de color: antes
          vivían repetidos como bloque grande en cada página, ahora viven acá
          una sola vez. */}
      <div className="flex items-center gap-3 shrink-0 min-w-0 flex-1 sm:flex-none sm:w-64 md:w-80">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${section.iconBg} border ${section.iconBorder} flex items-center justify-center shrink-0`}>
            <SectionIcon size={18} className={section.iconColor} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-display font-extrabold text-white tracking-tight truncate">{section.name}</h1>
            {section.subtitle && (
              <p className="hidden sm:block text-[9px] text-gray-500 font-semibold uppercase tracking-wider truncate">{section.subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Búsqueda global (desktop): centrada respecto al nav completo
          (posición absoluta, independiente del ancho del título o del bloque
          de notificaciones/perfil) para que no se corra al cambiar de
          sección. En mobile pasa a un ícono que abre pantalla completa (ver
          bloque debajo del header) — no compite por espacio con título/avatar. */}
      <div className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[calc(100%-2rem)] z-10">
        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder="Buscar cliente, reserva o unidad..."
        />

        {showDropdown && (
          <>
            {/* Backdrop: cierra el dropdown al tocar afuera */}
            <div className="fixed inset-0 z-40" onClick={closeSearch} />
            <div className="absolute left-0 right-0 mt-2 glass-popover rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto">
              {!activo ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500">Seguí escribiendo (mínimo 2 caracteres)...</p>
              ) : clienteMatches.length === 0 && reservaMatches.length === 0 ? (
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
                              {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}
                            </span>
                          </span>
                          <StatusBadge status={estadoBadgeStatus(reserva)} />
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

      <div className="flex items-center gap-1 sm:gap-6 shrink-0 ml-auto">
        {/* Búsqueda (mobile): ícono que abre pantalla completa */}
        <button
          onClick={() => setMobileSearchOpen(true)}
          className="sm:hidden text-gray-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 transition-all"
        >
          <Search size={20} />
        </button>
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
                      // Mismo destino por tipo que Notificaciones.jsx
                      // (Tarea 2): saldo -> Clientes con la reserva
                      // resaltada, checkin -> Plano del día con la unidad
                      // resaltada. "Caja pendiente" no tiene destino: queda
                      // inerte.
                      const destino =
                        item.type === 'saldo' && item.clienteId
                          ? linkToCliente(item.clienteId, { reservaId: item.reservaId })
                          : item.type === 'checkin'
                            ? linkToPlano(new Date().toISOString().split('T')[0], item.unidadId)
                            : null
                      const Tag = destino ? 'button' : 'div'
                      return (
                        <Tag
                          key={item.id}
                          type={destino ? 'button' : undefined}
                          onClick={destino ? () => { navigate(destino); setShowNotifications(false) } : undefined}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all ${destino ? 'hover:bg-white/10 cursor-pointer' : 'hover:bg-white/5'}`}
                        >
                          <Icon size={16} className="text-[#FDE047] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.titulo}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{item.detalle}</p>
                          </div>
                        </Tag>
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
              {nombreMostrado.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-white hidden sm:block">
              {nombreMostrado}
            </span>
            <ChevronDown size={14} className="text-gray-500" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-56 glass-popover rounded-xl overflow-hidden z-50 p-1">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{rolLabel}</p>
                <p className="text-xs font-medium text-white truncate">{nombreMostrado}</p>
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

      {/* Búsqueda mobile a pantalla completa (Tarea 4.2) — mismos resultados
          que el buscador de desktop, reutiliza clienteMatches/reservaMatches. */}
      {mobileSearchOpen && createPortal(
        <div className="sm:hidden fixed inset-0 z-[997] bg-[#05070c] flex flex-col">
          <div className="flex items-center gap-3 px-4 h-20 border-b border-white/5 shrink-0">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Buscar cliente, reserva o unidad..."
              autoFocus
              className="flex-1 min-w-0"
            />
            <button
              onClick={() => { setMobileSearchOpen(false); closeSearch() }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!showDropdown ? (
              <p className="px-6 py-8 text-center text-xs text-gray-500">Escribí para buscar un cliente, una reserva o una unidad (ej. "carpa 19").</p>
            ) : !activo ? (
              <p className="px-6 py-8 text-center text-xs text-gray-500">Seguí escribiendo (mínimo 2 caracteres)...</p>
            ) : clienteMatches.length === 0 && reservaMatches.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-gray-500">Sin resultados para "{searchValue}"</p>
            ) : (
              <>
                {clienteMatches.length > 0 && (
                  <div>
                    <p className="px-4 pt-4 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Clientes</p>
                    {clienteMatches.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => { goToCliente(cliente); setMobileSearchOpen(false) }}
                        className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-white/10 transition-colors border-b border-white/5"
                      >
                        <p className="text-sm font-bold text-white truncate">{cliente.nombre}</p>
                        {cliente.telefono && <p className="text-xs text-gray-500">{cliente.telefono}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {reservaMatches.length > 0 && (
                  <div>
                    <p className="px-4 pt-4 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reservas</p>
                    {reservaMatches.map((reserva) => (
                      <button
                        key={reserva.id}
                        onClick={() => { goToReserva(reserva); setMobileSearchOpen(false) }}
                        className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-white/10 transition-colors border-b border-white/5 flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-white truncate">{reserva.clientes?.nombre || 'S/N'}</span>
                          <span className="block text-xs text-gray-500 uppercase truncate">
                            {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}
                          </span>
                        </span>
                        <StatusBadge status={estadoBadgeStatus(reserva)} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </header>
  )
}

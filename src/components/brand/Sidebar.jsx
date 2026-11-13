import React, { useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { propsPrefetch } from '../../lib/prefetchRutas'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wallet,
  BarChart2,
  Map,
  LogOut,
  FileText,
  UserCheck,
  Settings,
  Activity,
  Inbox,
  GanttChartSquare,
  DoorClosed,
  QrCode,
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'
import { APP_VERSION } from '../../lib/appVersion'
import { CountBadge } from './Badge'
import SidebarCajaCard from './SidebarCajaCard'
import ScrollFade from '../ui/ScrollFade'

// Fondo del ítem activo: un solo nodo que se desliza con transform hasta el
// link activo. El alto cambia con la altura de pantalla, por eso se mide.
function useIndicadorActivo() {
  const { pathname } = useLocation()
  const contenedor = useRef(null)
  const indicador = useRef(null)

  useLayoutEffect(() => {
    const medir = () => {
      const activo = contenedor.current?.querySelector('a[aria-current="page"]')
      const pill = indicador.current
      if (!pill) return
      pill.style.opacity = activo ? '1' : '0'
      if (!activo) return
      const base = contenedor.current.getBoundingClientRect()
      const caja = activo.getBoundingClientRect()
      pill.style.height = `${caja.height}px`
      pill.style.transform = `translateY(${caja.top - base.top + contenedor.current.scrollTop}px)`
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [pathname])

  return { contenedor, indicador }
}

// Mobile-first (sept 2026): en pantallas chicas la navegación vive en
// BottomNav.jsx (5 ítems + "Más") — este Sidebar queda oculto por completo
// (hidden md:flex) en vez de convertirse en drawer, para no duplicar la
// misma navegación de dos formas distintas en mobile.
export default function Sidebar() {
  const navigate = useNavigate()
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso, perfil, rol } = useAuth()
  const { contenedor, indicador } = useIndicadorActivo()
  const nombreMostrado = perfil?.nombre || perfil?.usuario || 'Usuario'
  const rolLabel = rol === 'superadmin' ? 'Superadmin' : rol === 'admin' ? 'Admin' : ''

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const mainNav = [
    { name: 'Dashboard', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano de Playa', path: '/app/plano', icon: Map },
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(isFeatureEnabled('reportes') && permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
  ]

  const additionalNav = [
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    ...(isFeatureEnabled('ocupacion') ? [{ name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare }] : []),
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Mi cuenta', path: '/app/perfil', icon: UserCheck },
    // Ajustes que afectan a todos (categorías de egreso, avisos de cierre):
    // solo superadmin, igual que el guard real de la pantalla.
    ...(permiso('categorias_gasto') ? [{ name: 'Configuración', path: '/app/configuracion', icon: Settings }] : []),
  ]

  const renderItem = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      viewTransition
      {...propsPrefetch(item.path)}
      className={({ isActive }) =>
        `relative h-10 [@media(max-height:800px)]:h-9 flex items-center gap-3 px-3 rounded-nav text-body transition-colors ${
          isActive ? 'text-ink' : 'text-ink-2 hover:text-ink'
        }`
      }
    >
      <item.icon size={20} strokeWidth={1.5} className="relative shrink-0" />
      <span className="relative min-w-0 whitespace-nowrap">{item.name}</span>
      {item.comingSoon && <span className="relative ml-auto inline-flex items-center h-6 px-2 rounded-full bg-surface text-label text-ink-2">Pronto</span>}
      {item.badge > 0 && <CountBadge value={item.badge} className="relative ml-auto" />}
    </NavLink>
  )

  return (
    <aside className="no-print hidden lg:flex w-64 h-dvh bg-card flex-col shrink-0 sticky top-0 left-0 z-30">
      <div className="h-20 px-6 flex items-center gap-3 shrink-0">
        <img src="/images/prius-icon.png" alt="" className="w-9 h-9 object-contain shrink-0" />
        <div className="min-w-0">
          <p className="text-card-title text-ink leading-6">Prius</p>
          <p className="text-label text-ink-2 leading-4">Playa Grande</p>
        </div>
      </div>

      <ScrollFade ref={contenedor} wrapperClassName="flex-1" className="relative overflow-y-auto px-3 pb-3 space-y-4">
        <span ref={indicador} aria-hidden="true" className="absolute top-0 inset-x-3 rounded-nav bg-surface opacity-0 nav-indicador" />
        <nav aria-label="Gestión operativa">
          <h2 className="px-3 mb-1 text-label text-ink-2">Gestión operativa</h2>
          <div className="space-y-1">{mainNav.map(renderItem)}</div>
        </nav>
        <nav aria-label="Módulos adicionales">
          <h2 className="px-3 mb-1 text-label text-ink-2">Módulos adicionales</h2>
          <div className="space-y-1">{additionalNav.map(renderItem)}</div>
        </nav>
      </ScrollFade>

      <div className="p-3 pt-1 shrink-0 space-y-2">
        <SidebarCajaCard />
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/app/perfil')}
            title={APP_VERSION}
            className="flex-1 min-w-0 flex items-center gap-3 p-2 rounded-nav hover:bg-surface transition-colors text-left"
          >
            <span className="w-9 h-9 rounded-full bg-ink text-on-ink flex items-center justify-center text-body shrink-0">
              {nombreMostrado.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-body text-ink truncate">{nombreMostrado}</span>
              <span className="block text-label text-ink-2 truncate">{rolLabel || 'Guardia Sur'}</span>
            </span>
          </button>
          <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión" className="btn-icon text-ink-2 shrink-0">
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  )
}

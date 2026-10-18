import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wallet,
  BarChart2,
  Map,
  LogOut,
  Bell,
  FileText,
  UserCheck,
  Activity,
  Inbox,
  GanttChartSquare,
  DoorClosed,
  QrCode,
  Plus,
  User,
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'
import { APP_VERSION } from '../../lib/appVersion'

// Mobile-first (sept 2026): en pantallas chicas la navegación vive en
// BottomNav.jsx (5 ítems + "Más") — este Sidebar queda oculto por completo
// (hidden md:flex) en vez de convertirse en drawer, para no duplicar la
// misma navegación de dos formas distintas en mobile.
export default function Sidebar() {
  const navigate = useNavigate()
  // Badge: pendientes abiertas + novedades sin leer (ver CLAUDE.md
  // "Notificaciones") — mismo cómputo que usa el badge de la campana.
  const { countPendientes, countNovedadesNoLeidas } = useNotificaciones()
  const notificationsCount = countPendientes + countNovedadesNoLeidas
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso, perfil, rol } = useAuth()
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
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck }
  ]

  // Estilo de ítem activo/inactivo del mock (Stitch 01-home-desktop): borde
  // derecho dorado + fondo prius-surface cuando está activo, en vez del
  // borde izquierdo + prius-subtle que tenía antes.
  const linkClass = ({ isActive }) => `
    flex items-center justify-between gap-2 px-space-md py-space-sm rounded-l-lg text-title-md transition-colors
    ${isActive
      ? 'bg-prius-surface text-black border-r-2 border-gold'
      : 'text-prius-slate hover:bg-prius-surface hover:text-black'
    }
  `

  return (
    <aside className="no-print hidden lg:flex w-64 h-dvh bg-white border-r border-hairline flex-col justify-between shrink-0 sticky top-0 left-0 z-30 font-ui">
      <div className="flex flex-col overflow-hidden">
        {/* Brand Header — logo/ícono reales del proyecto, nunca el placeholder del mock */}
        <div className="p-space-lg border-b border-hairline">
          <div className="flex items-center gap-space-sm">
            <img src="/images/prius-icon.png" alt="Prius" className="w-8 h-8 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="text-headline-sm text-black leading-none truncate">Prius</div>
              <div className="text-label-md text-prius-slate uppercase mt-1 truncate">Playa Grande · CRM</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/reservas')}
            className="w-full mt-space-lg h-12 rounded-xl bg-gold text-black text-label-lg flex items-center justify-center gap-space-sm hover:bg-gold-hover transition-colors"
          >
            <Plus size={18} />
            <span>Nueva reserva</span>
          </button>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-space-md space-y-space-lg">
          <div>
            <h2 className="px-space-md text-label-md text-prius-slate uppercase mb-2">
              Gestión Operativa
            </h2>
            <nav className="space-y-0.5">
              {mainNav.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass}>
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold bg-prius-surface text-prius-slate rounded uppercase tracking-wider">
                      Pronto
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="px-space-md text-label-md text-prius-slate uppercase mb-2">
              Módulos Adicionales
            </h2>
            <nav className="space-y-0.5">
              {additionalNav.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass}>
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gold text-black rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Footer: tarjeta de usuario (mock) + cerrar sesión + versión */}
      <div className="p-space-md border-t border-hairline">
        <button onClick={() => navigate('/app/perfil')} className="w-full flex items-center gap-space-sm p-space-sm rounded-xl bg-prius-surface hover:bg-hairline transition-colors text-left">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
            <User size={16} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label-lg text-black truncate">{nombreMostrado}</p>
            <p className="text-label-md text-prius-slate truncate">{rolLabel || 'Guardia Sur'}</p>
          </div>
        </button>
        <div className="mt-space-sm px-space-xs flex items-center justify-between">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-label-md text-prius-slate hover:text-black transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
          <span className="w-2 h-2 rounded-full bg-prius-success" title={APP_VERSION} />
        </div>
      </div>
    </aside>
  )
}
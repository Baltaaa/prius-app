import { NavLink, useNavigate } from 'react-router-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import {
  LayoutDashboard, CalendarDays, Users, Wallet, BarChart2, Map, LogOut,
  Bell, FileText, UserCheck, Activity, Inbox, GanttChartSquare, DoorClosed, QrCode
} from 'lucide-react'
import { isFeatureEnabled } from '../../lib/features'

// Sidebar desktop (≥1024px) del sistema "Playa Privada": misma lista de
// navegación y permisos que crm/Sidebar.jsx (no se inventan secciones), look
// claro — fondo blanco, borde derecho hairline, activo con fondo
// prius-subtle + borde izquierdo dorado.
export function navItems({ leadsSinContactar, notificationsCount, permiso }) {
  const mainNav = [
    { name: 'Dashboard', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano de Playa', path: '/app/plano', icon: Map },
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed, comingSoon: true },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
  ]
  const additionalNav = [
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    { name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare },
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Notificaciones', path: '/app/notificaciones', icon: Bell, badge: notificationsCount },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck }
  ]
  return { mainNav, additionalNav }
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { countPendientes, countNovedadesNoLeidas } = useNotificaciones()
  const notificationsCount = countPendientes + countNovedadesNoLeidas
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso } = useAuth()
  const { mainNav, additionalNav } = navItems({ leadsSinContactar, notificationsCount, permiso })

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `flex items-center justify-between px-3 py-2.5 rounded-xl text-body-md font-medium transition-colors ${
      isActive ? 'bg-prius-subtle text-black border-l-2 border-gold' : 'text-prius-slate hover:bg-prius-subtle hover:text-black'
    }`

  return (
    <aside className="no-print hidden lg:flex w-64 h-dvh bg-white border-r border-hairline flex-col justify-between shrink-0 sticky top-0 left-0 z-30 font-ui">
      <div className="flex flex-col overflow-hidden">
        <div className="h-20 flex items-center px-4 border-b border-hairline gap-2">
          <img src="/images/prius-icon.png" alt="P" className="w-8 h-8 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-title-md text-black tracking-tight leading-none whitespace-nowrap">Prius Playa Grande</h1>
            <p className="text-label-md text-prius-muted uppercase mt-1">PriusApp</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          <div>
            <h2 className="px-3 text-label-md uppercase text-prius-muted mb-3">Gestión Operativa</h2>
            <nav className="space-y-1">
              {mainNav.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass}>
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold bg-prius-subtle text-prius-muted border border-hairline rounded uppercase tracking-wider">Pronto</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="px-3 text-label-md uppercase text-prius-muted mb-3">Módulos Adicionales</h2>
            <nav className="space-y-1">
              {additionalNav.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass}>
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className="shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gold text-black rounded-full">{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-hairline">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-body-md font-medium text-prius-slate hover:text-black transition-colors text-left"
        >
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}

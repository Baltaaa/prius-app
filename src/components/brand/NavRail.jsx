import { NavLink, useNavigate } from 'react-router-dom'
import {
  LogOut, LayoutDashboard, CalendarDays, Users, Wallet, BarChart2, Map,
  FileText, UserCheck, Activity, Inbox, GanttChartSquare, DoorClosed, QrCode,
} from 'lucide-react'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { isFeatureEnabled } from '../../lib/features'
import { CountBadge } from './Badge'

// NavRail tablet (768–1023px): mismos ítems y permisos que Sidebar.jsx /
// BottomNav.jsx (no se inventan secciones), solo íconos en una columna
// angosta fija — evita repetir el Sidebar completo (256px) en el rango donde
// el contenido operativo (plano + panel) necesita el ancho. Entre
// md (768px, donde aparece este rail) y lg (1024px, donde Sidebar.jsx toma
// la posta — ver `hidden lg:flex` que se le agregó ahí).
export default function NavRail() {
  const navigate = useNavigate()
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso } = useAuth()

  const items = [
    { name: 'Dashboard', path: '/app/home', icon: LayoutDashboard },
    { name: 'Plano de Playa', path: '/app/plano', icon: Map },
    { name: 'Cabinas y Lockers', path: '/app/cabinas-lockers', icon: DoorClosed },
    ...(isFeatureEnabled('recepcion') ? [{ name: 'Recepción', path: '/app/recepcion', icon: QrCode }] : []),
    { name: 'Reservas', path: '/app/reservas', icon: CalendarDays },
    { name: 'Clientes', path: '/app/clientes', icon: Users },
    { name: 'Caja Diaria', path: '/app/caja', icon: Wallet },
    ...(isFeatureEnabled('reportes') && permiso('reportes_globales') ? [{ name: 'Reportes', path: '/app/reportes', icon: BarChart2 }] : []),
    { name: 'Leads', path: '/app/leads', icon: Inbox, badge: leadsSinContactar },
    ...(isFeatureEnabled('ocupacion') ? [{ name: 'Ocupación', path: '/app/ocupacion', icon: GanttChartSquare }] : []),
    { name: 'Historial', path: '/app/historial', icon: Activity },
    { name: 'Comprobantes', path: '/app/comprobantes', icon: FileText },
    { name: 'Mi cuenta', path: '/app/perfil', icon: UserCheck },
  ]

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `relative w-11 h-11 flex items-center justify-center rounded-nav transition-colors ${
      isActive ? 'bg-surface text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'
    }`

  return (
    <aside className="no-print hidden md:flex lg:hidden w-[72px] h-dvh bg-card flex-col items-center justify-between py-4 shrink-0 sticky top-0 left-0 z-30">
      <div className="flex flex-col items-center gap-1 overflow-y-auto w-full px-2">
        <img src="/images/prius-icon.png" alt="Prius" className="w-8 h-8 object-contain mb-4" />
        {items.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass} title={item.name}>
            <item.icon size={20} strokeWidth={1.5} />
            {item.badge > 0 && <CountBadge value={item.badge > 9 ? '9+' : item.badge} className="absolute -top-1 -right-1 scale-90" />}
          </NavLink>
        ))}
      </div>
      <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión" className="btn-icon text-ink-2">
        <LogOut size={18} strokeWidth={1.5} />
      </button>
    </aside>
  )
}

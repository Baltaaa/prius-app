import { NavLink, useNavigate } from 'react-router-dom'
import {
  LogOut, LayoutDashboard, CalendarDays, Users, Wallet, BarChart2, Map,
  FileText, UserCheck, Activity, Inbox, GanttChartSquare, DoorClosed, QrCode,
} from 'lucide-react'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { isFeatureEnabled } from '../../lib/features'

// NavRail tablet (768–1023px): mismos ítems y permisos que crm/Sidebar.jsx /
// crm/BottomNav.jsx (no se inventan secciones), solo íconos en una columna
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
    { name: 'Perfil y Tarifas', path: '/app/perfil', icon: UserCheck },
  ]

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `relative w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
      isActive ? 'bg-prius-subtle text-black' : 'text-prius-slate hover:bg-prius-subtle hover:text-black'
    }`

  return (
    <aside className="no-print hidden md:flex lg:hidden w-[72px] h-dvh bg-white border-r border-hairline flex-col items-center justify-between py-4 shrink-0 sticky top-0 left-0 z-30 font-ui">
      <div className="flex flex-col items-center gap-2 overflow-y-auto w-full px-2">
        <img src="/images/prius-icon.png" alt="P" className="w-8 h-8 object-contain mb-4" />
        {items.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass} title={item.name}>
            <item.icon size={20} />
            {item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-gold text-black text-[9px] font-bold flex items-center justify-center">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
      <button
        onClick={handleLogout}
        title="Cerrar sesión"
        className="w-11 h-11 flex items-center justify-center rounded-xl text-prius-slate hover:text-black hover:bg-prius-subtle transition-colors"
      >
        <LogOut size={18} />
      </button>
    </aside>
  )
}

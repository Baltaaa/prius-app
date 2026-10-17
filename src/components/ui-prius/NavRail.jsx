import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthProvider'
import { navItems } from './Sidebar'

// NavRail tablet (768–1023px): mismos ítems que Sidebar/BottomNav, solo
// íconos (sin label) en una columna angosta fija — evita repetir Sidebar
// completo (64px vs 256px) en el rango donde el contenido operativo
// (plano + panel) necesita el ancho.
export default function NavRail() {
  const navigate = useNavigate()
  const { countPendientes, countNovedadesNoLeidas } = useNotificaciones()
  const notificationsCount = countPendientes + countNovedadesNoLeidas
  const { sinContactar: leadsSinContactar } = useLeads()
  const { signOut, permiso } = useAuth()
  const { mainNav, additionalNav } = navItems({ leadsSinContactar, notificationsCount, permiso })
  const allItems = [...mainNav, ...additionalNav]

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
        {allItems.map((item) => (
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

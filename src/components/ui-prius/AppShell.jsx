import Sidebar from '../crm/Sidebar'
import BottomNav from '../crm/BottomNav'
import NavRail from './NavRail'

// AppShell "Playa Privada": decide la navegación por breakpoint — BottomNav
// <768px, NavRail 768–1023px (nuevo), Sidebar ≥1024px (ajustado de md a lg) —
// usando los mismos Sidebar/BottomNav reales de crm/ (ya re-estilizados al
// tema claro), no una copia paralela. `children` es el <main> completo
// (TopBar + Outlet), a cargo de AppLayout.jsx.
export default function AppShell({ children }) {
  return (
    <div className="h-dvh w-screen flex bg-white text-black font-ui overflow-hidden">
      <Sidebar />
      <NavRail />
      {children}
      <BottomNav />
    </div>
  )
}

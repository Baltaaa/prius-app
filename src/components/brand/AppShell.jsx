import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NavRail from './NavRail'

// Navegación por breakpoint: BottomNav <768px, NavRail 768–1023px, Sidebar
// ≥1024px. `children` es el <main> completo (Topbar + Outlet), a cargo de
// AppLayout.jsx.
export default function AppShell({ children }) {
  return (
    <div className="h-dvh w-screen flex bg-canvas text-ink overflow-hidden">
      <Sidebar />
      <NavRail />
      {children}
      <BottomNav />
    </div>
  )
}

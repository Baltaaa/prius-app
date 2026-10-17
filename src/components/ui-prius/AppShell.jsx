import Sidebar from './Sidebar'
import NavRail from './NavRail'
import BottomNav from './BottomNav'

// AppShell "Playa Privada": decide la navegación por breakpoint —
// BottomNav <768px, NavRail 768–1023px, Sidebar ≥1024px — y deja el resto
// del layout (TopBar, main scrollable) a cargo de quien lo use (AppLayout.jsx
// lo consume a medida que cada pantalla migra, Fase 2/3). `children` es el
// <main> completo (TopBar + Outlet) para no imponer su estructura interna.
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

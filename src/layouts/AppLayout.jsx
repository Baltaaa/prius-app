import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopBar from '../components/crm/TopBar'
import AppFooter from '../components/crm/AppFooter'
import AppShell from '../components/ui-prius/AppShell'
import InactivityWarningModal from '../components/crm/InactivityWarningModal'
import { DataProvider } from '../context/DataProvider'
import { DialogProvider } from '../context/DialogProvider'
import { NotificacionesProvider } from '../context/NotificacionesProvider'
import { OverlayProvider } from '../context/OverlayProvider'
import { useInactivityLogout } from '../hooks/useInactivityLogout'
import { useSection } from '../lib/sectionTitles'

// Mobile-first (sept 2026): el Sidebar con drawer quedó solo para desktop —
// en mobile la navegación completa vive en BottomNav (5 ítems + "Más"), así
// que no hace falta abrir/cerrar nada acá arriba.
export default function AppLayout() {
  // Tarea 3 (oct 2026): única instancia del hook de inactividad, montada
  // acá porque este layout solo se renderiza para el CRM autenticado.
  const { warning, secondsLeft, continuar, cerrarSesion } = useInactivityLogout()
  const location = useLocation()
  // Título + subtítulo de cada pantalla (antes vivían en TopBar.jsx, oct
  // 2026 rediseño shell: el header pasa a ser igual en todas las pantallas,
  // el título real baja al principio del contenido). Home no lo necesita:
  // ya tiene su propio saludo "Hola, {nombre}". Plano (Dashboard.jsx) no se
  // toca — el título se renderiza acá, por fuera del componente del plano.
  const esHome = location.pathname.startsWith('/app/home')
  const section = useSection(location.pathname)

  return (
    <OverlayProvider>
    <DialogProvider>
      <DataProvider>
        <NotificacionesProvider>
        <InactivityWarningModal
          open={warning}
          secondsLeft={secondsLeft}
          onContinuar={continuar}
          onCerrarSesion={cerrarSesion}
        />
        {/* h-dvh en vez de h-screen (100vh): en iOS Safari con la barra de
            direcciones visible, 100vh mide más que el alto visible real —
            con h-dvh el shell siempre ocupa exactamente lo que se ve,
            el BottomNav fijo y el contenido final de cada pantalla quedan
            dentro del área visible desde el primer render. AppShell decide
            Sidebar (≥1024px) / NavRail (768–1023px) / BottomNav (<768px). */}
        <AppShell>
          <div className="flex-1 flex flex-col h-dvh min-w-0 overflow-hidden relative">
            <TopBar />

            {/* Content View with internal vertical scroll. Padding horizontal
                IDÉNTICO al del header (px-4 sm:px-6 md:px-8, ver TopBar.jsx)
                para que el borde de las tarjetas quede alineado con el ícono
                del título — nunca max-w/mx-auto acá, el contenido ocupa todo
                el ancho entre el sidebar y el borde derecho. Definido una
                sola vez acá: ninguna página debe agregar su propio
                max-w/px/mx-auto que lo contradiga. pb-20 en mobile deja lugar
                al BottomNav fijo (56px + safe-area) para que no tape contenido. */}
            <main id="app-main-scroll" className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 md:py-8 w-full pb-20 md:pb-12 bg-prius-background">
              {!esHome && (
                <div className="no-print mb-space-lg">
                  <h1 className="text-headline-lg text-black tracking-tight">{section.name}</h1>
                  {section.subtitle && <p className="text-body-md text-prius-slate mt-1">{section.subtitle}</p>}
                </div>
              )}
              <Outlet />
              <div className="no-print">
                <AppFooter />
              </div>
            </main>
          </div>
        </AppShell>
        </NotificacionesProvider>
      </DataProvider>
    </DialogProvider>
    </OverlayProvider>
  )
}

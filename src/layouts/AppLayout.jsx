import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopBar from '../components/crm/TopBar'
import AppFooter from '../components/crm/AppFooter'
import AppShell from '../components/ui-prius/AppShell'
import InactivityWarningModal from '../components/crm/InactivityWarningModal'
import { DataProvider } from '../context/DataProvider'
import { DialogProvider } from '../context/DialogProvider'
import { NotificacionesProvider } from '../context/NotificacionesProvider'
import { NuevaReservaProvider } from '../context/NuevaReservaProvider'
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
  // Reservas/Clientes (mini-prompt 26/10/2026): en desktop (≥1024px) estas
  // dos secciones dejan de scrollear la página — la tabla/lista y la ficha
  // son dos cajas de igual alto que llenan exactamente el viewport. Acá
  // arriba solo se decide, por ruta, si esta vista participa de ese layout;
  // el breakpoint lo resuelve CSS puro (`lg:`) más abajo, no JS, para no
  // duplicar el estado de ancho que cada página ya trackea por su cuenta.
  const esSeccionAlturaFija = location.pathname.startsWith('/app/reservas') || location.pathname.startsWith('/app/clientes')

  // Pulido UX (oct 2026, item 4): se sacó el bloque visible de título de
  // sección (H1 + subtítulo) de todas las pantallas — ocupaba espacio y era
  // redundante (la sección activa ya se ve en el Sidebar/BottomNav). El
  // document.title sigue cambiando por sección, para accesibilidad y la
  // pestaña del navegador; el h1 visible pasa a sr-only más abajo.
  useEffect(() => {
    document.title = esHome ? 'Prius App' : `${section.name} · Prius App`
  }, [esHome, section.name])

  return (
    <OverlayProvider>
    <DialogProvider>
      <DataProvider>
        <NotificacionesProvider>
        <NuevaReservaProvider>
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
            {/* pb-bottom-nav-safe (pulido iPhone, oct 2026, ver index.css):
                antes un pb-20 (80px) fijo — con safe-area-inset-bottom
                grande (home indicator, iPhone con notch) el BottomNav mide
                más de 80px (56px + safe-area) y el contenido quedaba tapado
                atrás (caso real: cards de Caja). calc() explícito = altura
                real del nav (56px) + la safe area + 16px de aire, solo
                <768px — en desktop sigue siendo md:pb-12, sin cambios.
                overscroll-behavior: contain acá (no en html/body) para que
                el scroll propio de esta columna nunca "rebote" hacia el
                documento. */}
            {/* Reservas/Clientes en desktop (mini-prompt 26/10/2026): este
                `main` deja de ser el que scrollea (`lg:overflow-hidden`) —
                la página entera queda fija al alto del viewport y son las
                dos cajas de adentro (tabla/lista + ficha) las que scrollean
                por su cuenta si no entran. Por debajo de `lg` y en el resto
                de las secciones, sigue scrolleando como siempre
                (`overflow-y-auto`), sin cambios. El wrapper `flex-1
                min-h-0` alrededor del `<Outlet/>` es lo que le pasa esa
                altura disponible a la página — las páginas que no son
                Reservas/Clientes lo ignoran (siguen con su alto de
                contenido normal, el wrapper no les fuerza nada por fuera
                de `lg:`). */}
            <main
              id="app-main-scroll"
              className={`flex-1 flex flex-col overscroll-contain px-4 sm:px-6 md:px-8 py-4 md:py-8 w-full pb-bottom-nav-safe md:pb-12 bg-prius-background ${esSeccionAlturaFija ? 'overflow-y-auto lg:overflow-hidden' : 'overflow-y-auto'}`}
            >
              {/* h1 accesible oculto visualmente — el título visible de
                  sección se sacó (item 4), pero un lector de pantalla sigue
                  necesitando un h1 por página. Home tiene el suyo propio
                  ("Hola, {nombre}"), no se duplica acá. */}
              {!esHome && <h1 className="sr-only">{section.name}</h1>}
              <div className={esSeccionAlturaFija ? 'lg:flex-1 lg:min-h-0 lg:flex lg:flex-col' : undefined}>
                <Outlet />
              </div>
              {/* El footer global empujaría las cajas más allá del viewport
                  en Reservas/Clientes desktop — acá se oculta desde `lg`
                  (abajo de eso, mobile y tablet lo siguen viendo igual que
                  siempre). En el resto de las secciones no se toca. */}
              <div className={`no-print ${esSeccionAlturaFija ? 'lg:hidden' : ''}`}>
                <AppFooter />
              </div>
            </main>
          </div>
        </AppShell>
        </NuevaReservaProvider>
        </NotificacionesProvider>
      </DataProvider>
    </DialogProvider>
    </OverlayProvider>
  )
}

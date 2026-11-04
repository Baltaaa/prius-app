import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Topbar from '../components/brand/Topbar'
import ProgressiveBlurHeader from '../components/brand/ProgressiveBlurHeader'
import { ToolbarSlotContext } from '../components/brand/toolbarSlot'
import AppFooter from '../components/crm/AppFooter'
import AppShell from '../components/brand/AppShell'
import InactivityWarningModal from '../components/crm/InactivityWarningModal'
import { DataProvider } from '../context/DataProvider'
import { DialogProvider } from '../context/DialogProvider'
import { NotificacionesProvider } from '../context/NotificacionesProvider'
import { NuevaReservaProvider } from '../context/NuevaReservaProvider'
import { OverlayProvider } from '../context/OverlayProvider'
import { useInactivityLogout } from '../hooks/useInactivityLogout'
import { useRecepcionRemota } from '../hooks/useRecepcionRemota'
import { useSection } from '../lib/sectionTitles'

// Mobile-first (sept 2026): el Sidebar con drawer quedó solo para desktop —
// en mobile la navegación completa vive en BottomNav (5 ítems + "Más"), así
// que no hace falta abrir/cerrar nada acá arriba.
// El hook usa useDialog() y useAuth(), así que tiene que vivir DENTRO de los
// providers — por eso este componente intermedio en vez de llamarlo en
// AppLayout directo. No renderiza nada.
function PuenteRecepcionRemota() {
  useRecepcionRemota()
  return null
}

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
  // Plano (fix 28/10/2026): mismo problema que Reservas/Clientes tenían antes
  // de ese mini-prompt — el wrapper del Outlet no tenía altura/flex propios,
  // así que el `h-full` de Dashboard.jsx no tenía de qué ser "full" (el plano
  // quedaba chico, encogido al contenido) y el footer global quedaba flotando
  // a mitad de página en vez de pegado abajo. A diferencia de Reservas/
  // Clientes, acá el footer NO se oculta (se quiere visible siempre, pegado
  // abajo) y el fix aplica en todos los anchos, no solo desde `lg`.
  const esPlano = location.pathname.startsWith('/app/plano')
  // Comprobantes (nov 2026): la página nunca scrollea, ni vertical ni
  // horizontal. Alto = 100dvh menos la zona sticky, el footer (desktop) y la
  // bottom nav (mobile); la preview se escala para entrar y la lista de pagos
  // scrollea por dentro.
  const esComprobantes = location.pathname.startsWith('/app/comprobantes')

  // Pulido UX (oct 2026, item 4): se sacó el bloque visible de título de
  // sección (H1 + subtítulo) de todas las pantallas — ocupaba espacio y era
  // redundante (la sección activa ya se ve en el Sidebar/BottomNav). El
  // document.title sigue cambiando por sección, para accesibilidad y la
  // pestaña del navegador; el h1 visible pasa a sr-only más abajo.
  useEffect(() => {
    document.title = esHome ? 'Prius App' : `${section.name} · Prius App`
  }, [esHome, section.name])

  // Zona sticky superior (nov 2026): Topbar + toolbar de la sección flotan
  // sobre el contenido (ProgressiveBlurHeader). Su alto real se mide acá y se
  // publica como `--zona-h`: #app-main-scroll lo usa de padding superior
  // (clase `pt-zona`), así la página arranca justo debajo y lo demás pasa por
  // detrás. `slot` es el nodo donde las páginas montan su toolbar
  // (<ToolbarSticky>, un portal).
  const layoutRef = useRef(null)
  const zonaRef = useRef(null)
  const [slot, setSlot] = useState(null)
  useLayoutEffect(() => {
    const zona = zonaRef.current
    const layout = layoutRef.current
    if (!zona || !layout) return undefined
    const medir = () => layout.style.setProperty('--zona-h', `${zona.offsetHeight}px`)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(zona)
    return () => ro.disconnect()
  }, [])

  return (
    <OverlayProvider>
    <DialogProvider>
      <DataProvider>
        <NotificacionesProvider>
        <NuevaReservaProvider>
        <PuenteRecepcionRemota />
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
        <ToolbarSlotContext.Provider value={slot}>
        <AppShell>
          <div ref={layoutRef} className="layout-zona flex-1 flex flex-col h-dvh min-w-0 overflow-hidden relative">
            <ProgressiveBlurHeader ref={zonaRef} className="absolute top-0 inset-x-0 z-20">
              <Topbar />
              {/* Slot de la toolbar de la sección (ver ToolbarSticky.jsx). */}
              <div ref={setSlot} className="px-page-max pb-3 md:pb-4 empty:p-0" />
            </ProgressiveBlurHeader>

            {/* Content View with internal vertical scroll. Padding horizontal
                IDÉNTICO al del header (px-page-max, ver Topbar.jsx y "Espaciado" en DESIGN.md)
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
            {/* [overflow-x:clip]: red de seguridad contra el scroll horizontal
                (ej. texto largo sin espacios en Historial). `clip` no crea
                un nuevo scroll container (a diferencia de `hidden`), así que
                los hijos sticky siguen funcionando. */}
            <main
              id="app-main-scroll"
              className={`flex-1 flex flex-col overscroll-contain px-page-max w-full pb-bottom-nav-safe bg-canvas [overflow-x:clip] pt-zona ${esPlano ? 'md:pb-3' : esSeccionAlturaFija ? 'md:pb-12' : 'md:pb-0'} ${esSeccionAlturaFija ? 'overflow-y-auto lg:overflow-hidden' : esPlano ? 'max-md:overflow-hidden overflow-y-auto' : esComprobantes ? 'overflow-hidden' : 'overflow-y-auto'}`}
            >
              <div className={esSeccionAlturaFija ? 'lg:flex-1 lg:min-h-0 lg:flex lg:flex-col' : esPlano || esComprobantes ? 'flex-1 min-h-0 flex flex-col' : undefined}>
                <Outlet />
              </div>
              {/* El footer global empujaría las cajas más allá del viewport
                  en Reservas/Clientes desktop — acá se oculta desde `lg`
                  (abajo de eso, mobile y tablet lo siguen viendo igual que
                  siempre). En el resto de las secciones no se toca. */}
              {/* mt-auto: el main es una columna que llena el viewport (h-dvh), así
                  que en páginas cortas el footer queda pegado al borde inferior y
                  solo lo empuja hacia abajo el contenido cuando es más largo. */}
              {/* Plano en mobile: la pantalla no scrollea (el mapa llena el alto
                  disponible), así que el footer no entra. */}
              <div className={`no-print mt-auto ${esSeccionAlturaFija ? 'lg:hidden' : ''} ${esPlano || esComprobantes ? 'max-md:hidden' : ''}`}>
                <AppFooter compacto={esPlano} />
              </div>
            </main>
          </div>
        </AppShell>
        </ToolbarSlotContext.Provider>
        </NuevaReservaProvider>
        </NotificacionesProvider>
      </DataProvider>
    </DialogProvider>
    </OverlayProvider>
  )
}

import { APP_VERSION } from '../../lib/appVersion'

// Footer del shell (mock 01-home-desktop/mobile) — al final del contenido de
// TODAS las pantallas, montado una sola vez en AppLayout.jsx. Desktop/tablet:
// fila con borde superior. Mobile: card gris (mismo bloque que el mock trae
// al pie de Home), con margen para no quedar tapada por el BottomNav fijo.
// `compacto` (29/10/2026): el Plano necesita todo el alto posible para que el
// mapa se encuadre más grande (pedido del administrador) — ahí el footer se
// monta igual, pegado abajo y con el mismo contenido, pero sin el pb/mt
// grandes que en esa pantalla valen ~40px de mapa. El resto de las secciones
// no cambia un píxel.
export default function AppFooter({ compacto = false }) {
  return (
    <>
      {/* Mobile: el footer no se muestra en pantalla; vive al final del sheet "Más" (BottomNav). */}
      <footer className={`hidden md:flex flex-col sm:flex-row items-center justify-between gap-2 text-label text-ink-2 ${
        compacto ? 'pt-2 pb-2 mt-2' : 'pt-2 pb-4 mt-6'
      }`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold" />
          <span className="text-ink">Prius Playa Grande</span>
          <span>•</span>
          <span>Sector Carpas y Balneario</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Mar del Plata · Buenos Aires</span>
          <span>•</span>
          <span>{APP_VERSION}</span>
        </div>
      </footer>

    </>
  )
}

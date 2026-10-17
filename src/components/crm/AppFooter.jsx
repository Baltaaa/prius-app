import { Umbrella } from 'lucide-react'
import { APP_VERSION } from '../../lib/appVersion'

// Footer del shell (mock 01-home-desktop/mobile) — al final del contenido de
// TODAS las pantallas, montado una sola vez en AppLayout.jsx. Desktop/tablet:
// fila con borde superior. Mobile: card gris (mismo bloque que el mock trae
// al pie de Home), con margen para no quedar tapada por el BottomNav fijo.
export default function AppFooter() {
  return (
    <>
      <footer className="hidden md:flex flex-col sm:flex-row items-center justify-between gap-2 pt-space-sm pb-space-xl mt-space-lg border-t border-hairline text-label-md text-prius-slate">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold" />
          <span className="text-black">Prius Playa Grande</span>
          <span>•</span>
          <span>Sector Carpas y Balneario</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Mar del Plata · Buenos Aires</span>
          <span>•</span>
          <span className="tracking-widest">{APP_VERSION}</span>
        </div>
      </footer>

      <div className="md:hidden mt-space-lg mb-6 rounded-xl p-3 bg-prius-surface flex items-center justify-between">
        <div className="flex items-center gap-2 text-prius-slate">
          <Umbrella size={18} />
          <span className="text-body-sm">Prius Playa Grande · Sector Carpas y Balneario</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-prius-slate shrink-0 ml-2">{APP_VERSION}</span>
      </div>
    </>
  )
}

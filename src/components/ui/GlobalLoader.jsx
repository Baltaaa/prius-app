import React from 'react'
import { Loader2 } from 'lucide-react'

// Splash de carga (B3, oct 2026 — rebrandeo): antes era bg-white con un
// borde gold al 30% y un glow difuso, se leía "traslúcido" y el logo casi
// no se distinguía. Ahora fondo negro sólido, logo a color pleno sin
// opacidad dentro de un círculo con borde dorado al 100%, texto y spinner
// dorados al 100% — contraste verificado ≥4.5:1 sobre #000 (gold #F2CA50
// da ~11:1, texto blanco no hace falta). Salida: fade de 250ms a cargo de
// quien desmonta este componente (Login.jsx ya reemplaza el árbol entero
// con un `animate-premium-fade`, no hace falta nada acá para eso).
export default function GlobalLoader({ message = 'Sincronizando...' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center">
        <div className="w-[72px] h-[72px] rounded-full border-2 border-[#F2CA50] bg-black flex items-center justify-center shrink-0">
          <img
            src="/images/prius-icon.png"
            alt="Prius"
            className="w-11 h-11 object-contain"
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Loader2 className="w-6 h-6 text-[#F2CA50] animate-spin" />
          <p className="text-label-md text-[#F2CA50] uppercase tracking-[0.3em] text-center">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

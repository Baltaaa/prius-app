import React from 'react'
import { Loader2 } from 'lucide-react'

// Splash de carga (B3, oct 2026 — rebrandeo): fondo negro sólido, logo a
// color pleno, texto y spinner dorados al 100% — contraste verificado
// ≥4.5:1 sobre #000 (gold #F2CA50 da ~11:1, texto blanco no hace falta).
// Pulido UX (oct 2026, item 1): se saca el círculo/anillo dorado que
// rodeaba el logo — queda el logo solo, sin el borde ni el fondo circular
// de atrás. Salida: fade de 250ms a cargo de quien desmonta este
// componente (Login.jsx ya reemplaza el árbol entero con un
// `animate-premium-fade`, no hace falta nada acá para eso).
export default function GlobalLoader({ message = 'Sincronizando...' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center">
        <img
          src="/images/prius-icon.png"
          alt="Prius"
          className="w-14 h-14 object-contain"
        />

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

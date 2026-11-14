import React from 'react'
import { Loader2 } from 'lucide-react'

// Splash de carga. El fondo es el MISMO background de la app según el tema
// activo (`bg-canvas` -> --background), nunca un negro fijo: con el tema claro
// el negro era un flash en el medio del arranque. El tema ya está aplicado en
// <html> antes del primer pintado (public/tema-inicial.js), así que esto nunca
// cambia de color a mitad de camino.
//
// Logo solo, sin círculo ni anillo (pulido UX oct 2026). Spinner y texto en
// `ink`/`ink-2`: el dorado de marca no llega a AA sobre el canvas claro.
//
// Salida: el fade de 250ms lo hace ArranqueGate.jsx (arranque de la app) o
// quien desmonte este componente.
export default function GlobalLoader({ message = 'Sincronizando...' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-canvas">
      <div className="flex flex-col items-center">
        <img
          src="/images/prius-icon.png"
          alt="Prius"
          className="w-14 h-14 object-contain"
        />

        <div className="mt-8 flex flex-col items-center gap-4">
          <Loader2 className="w-6 h-6 text-ink animate-spin" />
          <p className="text-label text-ink-2 text-center">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

// 404 real (Tarea 9, oct 2026) — antes cualquier ruta desconocida dentro de
// /app redirigía en silencio a Home, sin avisar que el link estaba roto.
export default function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center animate-premium-fade">
      <Compass size={32} className="text-ink-2" />
      <div>
        <p className="text-label text-ink">Página no encontrada</p>
        <p className="text-label text-ink-2 mt-2">La dirección a la que llegaste no existe o ya no está disponible.</p>
      </div>
      <Link
        to="/app/home"
        className="text-label mt-2 px-5 py-3 bg-ink hover:bg-chart-2 rounded-full transition-all text-on-ink"
      >
        Volver al Home
      </Link>
    </div>
  )
}

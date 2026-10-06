import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

// 404 real (Tarea 9, oct 2026) — antes cualquier ruta desconocida dentro de
// /app redirigía en silencio a Home, sin avisar que el link estaba roto.
export default function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center animate-premium-fade">
      <Compass size={32} className="text-gray-600" />
      <div>
        <p className="text-sm font-bold text-white uppercase tracking-widest">Página no encontrada</p>
        <p className="text-xs text-gray-500 mt-2">La dirección a la que llegaste no existe o ya no está disponible.</p>
      </div>
      <Link
        to="/app/home"
        className="mt-2 px-5 py-3 bg-[#FDE047] hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all"
      >
        Volver al Home
      </Link>
    </div>
  )
}

import { Loader2 } from 'lucide-react'

// Botón con loader inline (oct 2026, Tarea 5): único componente para
// cualquier acción CRUD que tarde — reemplaza al texto (o va a su
// izquierda) mientras `loading`, mantiene el ancho del botón y lo
// deshabilita para evitar doble envío. Nunca un loader de pantalla
// completa fuera del primer arranque de la app (eso sigue siendo
// GlobalLoader, montado solo en PrivateRoute/Login).
export default function LoadingButton({
  loading = false,
  disabled = false,
  children,
  loadingText,
  className = '',
  type = 'button',
  onClick,
  ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 motion-reduce:transition-none disabled:opacity-50 ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin motion-reduce:animate-none text-[#F2CA50]" />}
      {loading ? (loadingText ?? children) : children}
    </button>
  )
}

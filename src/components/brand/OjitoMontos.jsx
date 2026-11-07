import { Eye, EyeOff } from 'lucide-react'
import { usePrivacidad } from '../../context/PrivacidadProvider'

// Ojito del modo privacidad global (como una billetera virtual): oculta o muestra TODOS los
// montos de la app. Hay dos en pantalla — el KPI de cobranzas del Dashboard y la card de la Caja
// diaria — y los dos controlan el mismo estado. Target de 44px.
// `sobre`: 'oscuro' (superficie grafito de la card de la Caja, oscura en los dos temas) o 'claro' (el hero dorado).
export default function OjitoMontos({ sobre = 'claro', className = '' }) {
  const { oculto, alternar } = usePrivacidad()
  const tono = sobre === 'oscuro'
    ? 'text-on-scrim/70 hover:text-on-scrim hover:bg-on-scrim/10'
    : 'text-ink/70 hover:text-ink hover:bg-ink/10'
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oculto ? 'Mostrar montos' : 'Ocultar montos'}
      aria-pressed={oculto}
      title={oculto ? 'Mostrar montos' : 'Ocultar montos'}
      className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full transition-colors ${tono} ${className}`}
    >
      {oculto ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
    </button>
  )
}

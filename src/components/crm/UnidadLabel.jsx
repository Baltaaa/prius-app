import { formatUnidad } from '../../lib/format'
import { unidadEmoji } from '../../lib/unidadIcono'

// Emoji del tipo de unidad (lib/unidadIcono.js). Mide 1em, igual que el texto
// que lo acompaña, y no se lee en voz alta: el nombre ya lo dice.
export function UnidadIcono({ tipo, className = '' }) {
  const emoji = unidadEmoji(tipo)
  return emoji ? <span aria-hidden className={`shrink-0 leading-none not-italic ${className}`}>{emoji}</span> : null
}

// "🏠 Carpa 19", o solo "🏠 19" con `soloNumero` (filas de lista).
export default function UnidadLabel({ tipo, numero, soloNumero = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <UnidadIcono tipo={tipo} />
      <span>{soloNumero ? numero : formatUnidad(tipo, numero)}</span>
    </span>
  )
}

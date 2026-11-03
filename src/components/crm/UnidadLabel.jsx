import { Tent, Umbrella } from 'lucide-react'
import { formatUnidad } from '../../lib/format'

// Ícono de tipo de unidad: sombrilla y carpa. Cabinas y lockers no llevan.
const ICONOS = { sombrilla: Umbrella, carpa: Tent }

export function UnidadIcono({ tipo, size = 16, className = '' }) {
  const Icono = ICONOS[tipo]
  return Icono ? <Icono size={size} strokeWidth={1.5} className={`shrink-0 text-ink-2 ${className}`} aria-hidden /> : null
}

// "[ícono] Carpa 19", o solo "[ícono] 19" con `soloNumero` (filas de lista).
export default function UnidadLabel({ tipo, numero, soloNumero = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <UnidadIcono tipo={tipo} />
      <span>{soloNumero ? numero : formatUnidad(tipo, numero)}</span>
    </span>
  )
}

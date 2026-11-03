import { Clock, Hourglass } from 'lucide-react'
import { COLOR_ESTADO } from '../../lib/colors'

// Único indicador de estado de una reserva en toda la app: nunca se repite con
// otro texto o ícono al lado. Los colores salen de lib/colors.ts, los mismos
// del Plano; parcial y sin pago comparten color y se distinguen por el texto.
const ESTADOS = {
  pagado: { color: COLOR_ESTADO.pagado, label: 'Pagado' },
  parcial: { color: COLOR_ESTADO.conSaldo, label: 'Pago parcial' },
  pendiente: { color: COLOR_ESTADO.conSaldo, label: 'Sin pago' },
  // Cliente de la temporada pasada sin confirmar todavía para la actual: no es
  // deuda, nunca se ve igual que "pendiente".
  pendiente_confirmacion: { color: COLOR_ESTADO.sinConfirmar, label: 'Sin confirmar', icon: Hourglass },
  // Reemplaza al estado de pago, nunca convive con él (ver `estadoBadgeStatus`
  // en lib/reservas.js).
  bonificada: { color: COLOR_ESTADO.neutro, label: 'Bonificada' },
  // Reserva web sin compromiso todavía, mismo mecanismo que Bonificada.
  preconfirmada: { color: COLOR_ESTADO.sinConfirmar, label: 'Preconfirmada', icon: Clock },
  // Venció sin check-in: la unidad ya se liberó.
  vencida: { color: COLOR_ESTADO.neutro, label: 'Vencida' },
}

export default function StatusBadge({ status }) {
  const { color, label, icon: Icon } = ESTADOS[status?.toLowerCase()] || { color: COLOR_ESTADO.neutro, label: status }
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-label whitespace-nowrap ${color.bg} ${color.border} ${color.text}`}>
      {Icon && <Icon size={12} strokeWidth={1.5} />}
      {label}
    </span>
  )
}

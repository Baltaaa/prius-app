import { HelpCircle } from 'lucide-react'
import { formatMonto } from '../../lib/format'
import { esPendienteConfirmacion, saldoNumerico } from '../../lib/reservas'

// Saldo de una reserva — homólogo de MontoReserva.jsx pero para el lado del
// saldo, y con la misma regla: nunca leer `reserva.saldo` directo. Recibe los
// pagos de ESA reserva puntual (no vienen embebidos en `reservas`) para poder
// derivar el número siempre de estado_pago + pagos reales.
export default function SaldoReserva({ reserva, pagos = [], className = '' }) {
  if (esPendienteConfirmacion(reserva)) {
    return <span className={`text-ink-2 font-semibold ${className}`}>Sin confirmar</span>
  }

  const saldo = saldoNumerico(reserva, pagos)

  if (saldo === null) {
    return (
      <span className={`text-label inline-flex items-center gap-2 text-ink-2 whitespace-nowrap ${className}`}>
        <HelpCircle size={13} /> Sin verificar
      </span>
    )
  }

  return (
    <span className={`font-semibold ${saldo > 0 ? 'text-danger' : 'text-success-ink'} ${className}`}>
      {saldo > 0 ? formatMonto(saldo) : 'Unidad saldada'}
    </span>
  )
}

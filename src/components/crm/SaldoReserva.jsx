import { HelpCircle } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import { esPendienteConfirmacion, saldoNumerico } from '../../lib/reservas'

// Saldo de una reserva — homólogo de MontoReserva.jsx pero para el lado del
// saldo, y con la misma regla: nunca leer `reserva.saldo` directo. Recibe los
// pagos de ESA reserva puntual (no vienen embebidos en `reservas`) para poder
// derivar el número siempre de estado_pago + pagos reales.
export default function SaldoReserva({ reserva, pagos = [], className = '' }) {
  if (esPendienteConfirmacion(reserva)) {
    return <span className={`text-gray-400 font-bold ${className}`}>Sin confirmar</span>
  }

  const saldo = saldoNumerico(reserva, pagos)

  if (saldo === null) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-gray-500 font-bold text-xs uppercase tracking-widest ${className}`}>
        <HelpCircle size={13} /> Sin verificar
      </span>
    )
  }

  return (
    <span className={`font-bold ${saldo > 0 ? 'text-red-400' : 'text-green-400'} ${className}`}>
      {saldo > 0 ? formatCurrency(saldo) : 'Unidad saldada'}
    </span>
  )
}

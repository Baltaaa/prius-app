import { HelpCircle, Gift, Hourglass } from 'lucide-react'
import { formatPesos, formatPesosVisible } from '../../lib/format'
import { montoInfo, esPendienteConfirmacion } from '../../lib/reservas'

// Un "$0" en pantalla es ambiguo: puede ser un monto real (bonificado) o un
// monto que no se cargó porque no se pudo verificar/repartir (Ana Lescano:
// 3 períodos de duración distinta sin desglose confiable de los $3.100.000
// reales — ver auditoría sep 2026). Este componente es el único lugar que
// decide cómo mostrar valor_total, para que "sin verificar" nunca se vea
// idéntico a "$0 real".
export default function MontoReserva({ reserva, className = '' }) {
  const { pendiente, bonificada, valorTotal, montoGrupoReferencia } = montoInfo(reserva)

  // Cliente histórico sin confirmar: el precio directamente no existe
  // todavía (no es "$0" real) — distinto del caso "sin verificar" de abajo,
  // que sí tiene un monto real sin repartir.
  if (esPendienteConfirmacion(reserva)) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-gray-500 font-bold text-xs uppercase tracking-widest ${className}`}>
        <Hourglass size={13} /> Sin confirmar
      </span>
    )
  }

  if (pendiente) {
    return (
      <span className={`inline-flex flex-col ${className}`}>
        <span className="inline-flex items-center gap-1.5 text-gray-500 font-bold text-xs uppercase tracking-widest">
          <HelpCircle size={13} /> Sin verificar
        </span>
        {montoGrupoReferencia != null && (
          <span className="text-[10px] text-gray-600 normal-case font-normal">
            Grupo: {formatPesos(montoGrupoReferencia)}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {formatPesosVisible(valorTotal)}
      {bonificada && (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded">
          <Gift size={10} /> Bonificada
        </span>
      )}
    </span>
  )
}

import React from 'react'

export default function StatusBadge({ status }) {
  // Único indicador de estado de una reserva en toda la app — nunca se
  // repite con otro texto/ícono de estado al lado (ver CLAUDE.md "Estados de
  // reserva: un solo indicador"). Labels fijados sep. 2026.
  const config = {
    pagado: {
      bg: 'bg-success-soft text-success-ink border-success/30',
      label: 'Pagado'
    },
    parcial: {
      bg: 'bg-gold-100 text-ink border-gold-300',
      label: 'Pago parcial'
    },
    pendiente: {
      bg: 'bg-danger-soft text-danger-ink border-danger/30',
      label: 'Sin pago'
    },
    // Cliente de la temporada pasada sin confirmar todavía para la actual —
    // nunca se debe ver igual que "pendiente" (ese es precio ya acordado sin
    // cobrar del todo). Tono neutro/informativo, no rojo (no es una deuda).
    pendiente_confirmacion: {
      bg: 'bg-surface text-ink-2 border-line',
      label: 'Sin confirmar'
    },
    // Reemplaza al badge de estado_pago, nunca convive con él — ver
    // lib/reservas.js `estadoBadgeStatus`, el único lugar que decide cuál de
    // los dos mostrar.
    bonificada: {
      bg: 'bg-surface text-ink-2 border-line',
      label: 'Bonificada'
    },
    // Fase 3 (Recepción, D7): reserva web sin compromiso todavía — reemplaza
    // al badge de estado_pago mientras esté vigente, mismo mecanismo que
    // "Bonificada" (ver lib/reservas.js `estadoBadgeStatus`).
    preconfirmada: {
      bg: 'bg-surface text-ink-2 border-line',
      label: 'Preconfirmada'
    },
    // Venció por vence_at sin check-in — la unidad ya se liberó, sin acción
    // primaria posible (nunca convive con otro badge de esa misma reserva).
    vencida: {
      bg: 'bg-surface text-ink-2 border-line',
      label: 'Vencida'
    }
  }

  const current = config[status?.toLowerCase()] || { bg: 'bg-surface text-ink-2 border-line', label: status }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-swatch text-[11px] font-bold tracking-wider uppercase border whitespace-nowrap ${current.bg}`}>
      {current.label}
    </span>
  )
}
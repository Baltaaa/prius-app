import React from 'react'

export default function StatusBadge({ status }) {
  // Único indicador de estado de una reserva en toda la app — nunca se
  // repite con otro texto/ícono de estado al lado (ver CLAUDE.md "Estados de
  // reserva: un solo indicador"). Labels fijados sep. 2026.
  const config = {
    pagado: {
      bg: 'bg-green-50 text-green-700 border-green-200',
      label: 'Pagado'
    },
    parcial: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Seña parcial'
    },
    pendiente: {
      bg: 'bg-red-50 text-red-700 border-red-200',
      label: 'Sin pago'
    },
    // Cliente de la temporada pasada sin confirmar todavía para la actual —
    // nunca se debe ver igual que "pendiente" (ese es precio ya acordado sin
    // cobrar del todo). Tono neutro/informativo, no rojo (no es una deuda).
    pendiente_confirmacion: {
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      label: 'Sin confirmar'
    },
    // Reemplaza al badge de estado_pago, nunca convive con él — ver
    // lib/reservas.js `estadoBadgeStatus`, el único lugar que decide cuál de
    // los dos mostrar.
    bonificada: {
      bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      label: 'Bonificada'
    },
    // Fase 3 (Recepción, D7): reserva web sin compromiso todavía — reemplaza
    // al badge de estado_pago mientras esté vigente, mismo mecanismo que
    // "Bonificada" (ver lib/reservas.js `estadoBadgeStatus`).
    preconfirmada: {
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      label: 'Preconfirmada'
    },
    // Venció por vence_at sin check-in — la unidad ya se liberó, sin acción
    // primaria posible (nunca convive con otro badge de esa misma reserva).
    vencida: {
      bg: 'bg-neutral-100 text-neutral-500 border-neutral-300',
      label: 'Vencida'
    }
  }

  const current = config[status?.toLowerCase()] || { bg: 'bg-neutral-100 text-neutral-700 border-neutral-200', label: status }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${current.bg}`}>
      {current.label}
    </span>
  )
}
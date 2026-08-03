import React from 'react'

export default function StatusBadge({ status }) {
  const config = {
    pagado: {
      bg: 'bg-green-50 text-green-700 border-green-200',
      label: 'PAGADO'
    },
    parcial: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'PARCIAL'
    },
    pendiente: {
      bg: 'bg-red-50 text-red-700 border-red-200',
      label: 'PENDIENTE'
    }
  }

  const current = config[status?.toLowerCase()] || { bg: 'bg-neutral-100 text-neutral-700 border-neutral-200', label: status }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${current.bg}`}>
      {current.label}
    </span>
  )
}
import React from 'react'

export default function StatusBadge({ status }) {
  const config = {
    pagado: {
      bg: 'bg-green-100 text-green-800 border-green-200',
      label: 'PAGADO'
    },
    parcial: {
      bg: 'bg-orange-100 text-orange-800 border-orange-200',
      label: 'PARCIAL'
    },
    pendiente: {
      bg: 'bg-red-100 text-red-800 border-red-200',
      label: 'PENDIENTE'
    }
  }

  const current = config[status?.toLowerCase()] || { bg: 'bg-neutral-100 text-neutral-800 border-neutral-200', label: status }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] font-extrabold uppercase tracking-widest border ${current.bg}`}>
      {current.label}
    </span>
  )
}
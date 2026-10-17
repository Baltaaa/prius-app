import React from 'react'

// Chip/filtro pill: inactivo gris claro, activo negro sólido, highlight dorado.
export default function Chip({ active, highlight, className = '', children, ...props }) {
  const tone = highlight
    ? 'bg-gold border-gold text-black'
    : active
      ? 'bg-black border-black text-white'
      : 'bg-prius-subtle border-hairline text-prius-slate'
  return (
    <button
      type="button"
      className={`h-8 px-3 rounded-full border text-body-sm font-medium font-ui whitespace-nowrap transition-colors ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

import React from 'react'

// Sistema de diseño "Playa Privada" (rediseño oct 2026, fuente: Stitch).
// Botones planos sin sombra: primario negro/blanco, acento dorado, ghost
// con borde hairline. Altura 48px / rounded-xl, estados activos sin glow.
const VARIANTS = {
  primary: 'bg-black text-white active:bg-[#222222] disabled:bg-black/30',
  accent: 'bg-gold text-black active:bg-gold-hover disabled:bg-gold/40',
  ghost: 'bg-white text-black border border-hairline active:bg-prius-subtle disabled:text-prius-muted',
  danger: 'bg-prius-error text-white active:bg-prius-error/90 disabled:bg-prius-error/30',
}

const SIZES = {
  md: 'h-12 px-4 text-body-md',
  sm: 'h-9 px-3 text-body-sm',
}

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={`font-ui font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed min-h-[44px] ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 16 : 18} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 16 : 18} />}
    </Component>
  )
}

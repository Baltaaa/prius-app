import React, { forwardRef } from 'react'

// Input de texto genérico del sistema nuevo. Los inputs tipados reales
// (MoneyInput, DniInput, CuitInput, PhoneInput, DateInput) siguen viviendo en
// src/components/inputs/ con su propia lógica de parseo — esto es solo el
// shell visual para los que no necesitan formato especial (nombre, notas, etc).
const Input = forwardRef(function Input({ label, error, className = '', id, ...props }, ref) {
  return (
    <label className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-label-md uppercase tracking-wider text-prius-slate">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={`h-12 px-4 rounded-xl border bg-white text-body-lg text-black placeholder:text-prius-muted font-ui
          focus:outline-none focus:border-[1.5px] ${error ? 'border-prius-error' : 'border-hairline focus:border-black'} ${className}`}
        {...props}
      />
      {error && <span className="text-body-sm text-prius-error">{error}</span>}
    </label>
  )
})

export default Input

import { useState, useEffect } from 'react'

const thousands = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

// Input de moneda reutilizable: por fuera entrega/recibe un number crudo
// (sin formato), pero muestra "$ 1.500.000" en vivo mientras se tipea.
// Un solo componente para valor_total/saldo (Clientes, Reservas) y monto de
// pagos (PagoModal) — evita reimplementar el formateo por pantalla.
export default function CurrencyInput({ value, onChange, className = '', placeholder, required, disabled }) {
  const [display, setDisplay] = useState(value || value === 0 ? thousands.format(value) : '')

  // Sincroniza si el valor cambia desde afuera (ej. al abrir el modal en edición)
  useEffect(() => {
    setDisplay(value || value === 0 ? thousands.format(value) : '')
  }, [value])

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setDisplay('')
      onChange(0)
      return
    }
    const n = Number(digits)
    setDisplay(thousands.format(n))
    onChange(n)
  }

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold pointer-events-none">
        $
      </span>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={`pl-8 ${className}`}
      />
    </div>
  )
}

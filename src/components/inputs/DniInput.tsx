import { useState, useEffect, useRef } from 'react'
import { formatDNI } from '../../lib/format'
import { parseDNI, dniValido } from '../../lib/parse'

/**
 * DNI con puntos de miles mientras se escribe ("30.123.456"). Guarda/entrega
 * solo dígitos vía onChange. Opcional: muestra error si se pierde el foco
 * con un DNI incompleto.
 *
 * Uso: <DniInput label="DNI" value={dni} onChange={setDni} />
 */
export interface DniInputProps {
  label?: string
  hint?: string
  error?: string
  value: string
  onChange: (digits: string) => void
  onBlur?: () => void
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export default function DniInput({ label, hint, error, value, onChange, onBlur, required, disabled, className = '', id }: DniInputProps) {
  const [display, setDisplay] = useState(formatDNI(value))
  const autoId = useRef(`dni-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => setDisplay(formatDNI(value)), [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = parseDNI(e.target.value).slice(0, 8)
    onChange(digits)
    setDisplay(formatDNI(digits))
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="text-[11px] font-bold text-prius-muted uppercase tracking-widest block mb-2">
          {label}{required && <span className="text-prius-error ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        enterKeyHint="next"
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={display}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder="Ej: 30.123.456"
        aria-invalid={!!error}
        className={`w-full min-h-[44px] px-4 py-3 bg-prius-subtle border rounded-xl text-black text-base md:text-sm font-bold tabular-nums outline-none transition-all disabled:opacity-50 ${
          error ? 'border-red-500/60 focus:border-red-500' : 'border-hairline focus:border-gold/50'
        }`}
      />
      {error ? <p className="text-[11px] text-prius-error mt-1.5">{error}</p> : hint ? <p className="text-[11px] text-prius-muted mt-1.5">{hint}</p> : null}
    </div>
  )
}

export { dniValido }

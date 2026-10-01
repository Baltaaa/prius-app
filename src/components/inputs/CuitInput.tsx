import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { formatCUIT } from '../../lib/format'
import { parseCUIT, cuitValido } from '../../lib/parse'

/**
 * CUIT con guiones mientras se escribe ("20-30123456-7"). Valida el dígito
 * verificador al salir del campo y muestra un check sutil cuando es válido.
 *
 * Uso: <CuitInput label="CUIT" value={cuit} onChange={setCuit} required />
 */
export interface CuitInputProps {
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

export default function CuitInput({ label, hint, error, value, onChange, onBlur, required, disabled, className = '', id }: CuitInputProps) {
  const [display, setDisplay] = useState(formatCUIT(value))
  const [tocado, setTocado] = useState(false)
  const autoId = useRef(`cuit-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => setDisplay(formatCUIT(value)), [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = parseCUIT(e.target.value).slice(0, 11)
    onChange(digits)
    setDisplay(formatCUIT(digits))
  }

  const valido = value.length === 11 && cuitValido(value)

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
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
          onBlur={() => { setTocado(true); onBlur?.() }}
          placeholder="Ej: 20-30123456-7"
          aria-invalid={!!error}
          className={`w-full min-h-[44px] px-4 py-3 pr-9 bg-white/5 border rounded-xl text-white text-sm font-bold tabular-nums outline-none transition-all disabled:opacity-50 ${
            error ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-[#FDE047]/50'
          }`}
        />
        {tocado && valido && (
          <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
        )}
      </div>
      {error ? (
        <p className="text-[11px] text-red-400 mt-1.5">{error}</p>
      ) : tocado && valido ? (
        <p className="text-[11px] text-green-400 mt-1.5">CUIT válido</p>
      ) : hint ? (
        <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
}

export { cuitValido }

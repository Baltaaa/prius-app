import { useState, useEffect, useRef, forwardRef } from 'react'

/**
 * Input de enteros sin signo $ (cantidades, número de unidad, punto de venta,
 * número de comprobante). Mismas reglas que MoneyInput salvo el prefijo:
 * sin flechas, sin ceros a la izquierda, la rueda del mouse no cambia nada.
 *
 * Uso: <IntegerInput label="Cantidad de personas" value={n} onChange={setN} min={1} max={30} />
 */
export interface IntegerInputProps {
  label?: string
  hint?: string
  error?: string
  value: number | null
  onChange: (n: number | null) => void
  onBlur?: () => void
  min?: number
  max?: number
  padTo?: number // ej. 5 para punto de venta -> "00001"
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
}

const IntegerInput = forwardRef<HTMLInputElement, IntegerInputProps>(function IntegerInput(
  { label, hint, error, value, onChange, onBlur, min, max, padTo, placeholder, disabled, required, className = '', id },
  forwardedRef,
) {
  const [display, setDisplay] = useState(value != null ? String(value) : '')
  const autoId = useRef(`int-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => {
    setDisplay(value != null ? String(value) : '')
  }, [value])

  const aplicar = (n: number | null) => {
    if (n != null) {
      if (min != null && n < min) n = min
      if (max != null && n > max) n = max
    }
    onChange(n)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    setDisplay(digits)
    aplicar(digits ? Number(digits) : null)
  }

  const handleBlur = () => {
    if (padTo && value != null) setDisplay(String(value).padStart(padTo, '0'))
    onBlur?.()
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={forwardedRef}
        id={inputId}
        type="text"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={display}
        onChange={handleChange}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`field tabular-nums  ${
          error ? 'field-error' : ''
        }`}
      />
      {error ? <p className="text-label text-danger mt-1.5">{error}</p> : hint ? <p className="text-label text-ink-2 mt-1.5">{hint}</p> : null}
    </div>
  )
})

export default IntegerInput

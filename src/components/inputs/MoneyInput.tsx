import { useState, useEffect, useRef, forwardRef } from 'react'
import { parsePesos } from '../../lib/parse'

const thousands = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * Único input permitido para montos en toda la app (Tarea 2, guía
 * "Inputs, validación y formateo unificado"). Nunca un `<input type="number">`
 * a mano: sin flechas, sin ceros a la izquierda, formatea miles en vivo
 * manteniendo el cursor, acepta pegado ("$1.089.000,00" -> 1089000), bloquea
 * letras y la rueda del mouse. Devuelve entero o `null` (vacío ≠ 0).
 *
 * Uso:
 *   const [monto, setMonto] = useState<number | null>(null)
 *   <MoneyInput label="Monto" value={monto} onChange={setMonto} max={100_000_000} />
 *
 * Con react-hook-form: envolver con <Controller render={({field}) =>
 *   <MoneyInput value={field.value} onChange={field.onChange} />} />.
 */
export interface MoneyInputProps {
  label?: string
  hint?: string
  error?: string
  value: number | null
  onChange: (n: number | null) => void
  onBlur?: () => void
  min?: number
  max?: number
  permitirNegativo?: boolean
  permitirCero?: boolean
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  required?: boolean
  chips?: { label: string; value: number }[]
  className?: string
  id?: string
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  {
    label, hint, error, value, onChange, onBlur, min, max, permitirNegativo = false, permitirCero = true,
    placeholder = '0', disabled, loading, required, chips, className = '', id,
  },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)
  const [display, setDisplay] = useState(value != null ? thousands.format(value) : '')
  const autoId = useRef(`money-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => {
    setDisplay(value != null ? thousands.format(value) : '')
  }, [value])

  const setRef = (el: HTMLInputElement | null) => {
    innerRef.current = el
    if (typeof forwardedRef === 'function') forwardedRef(el)
    else if (forwardedRef) forwardedRef.current = el
  }

  // Nota: min/max NO se clampean en silencio acá — el input deja pasar lo que
  // el usuario escribió (salvo negativos si permitirNegativo=false) y es el
  // llamador quien valida contra min/max y muestra el error inline (`error`
  // prop), para no ocultarle al usuario que escribió algo fuera de rango.
  const aplicar = (n: number | null) => {
    if (n !== null && !permitirNegativo && n < 0) n = 0
    if (n === 0 && !permitirCero) n = null
    onChange(n)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const raw = input.value
    const cursorDesde = raw.length - input.selectionStart!

    // Solo dígitos (y un "-" adelante si se permite negativo) — bloquea letras.
    const permitido = permitirNegativo ? /[^\d-]/g : /[^\d]/g
    let digits = raw.replace(permitido, '')
    const negativo = permitirNegativo && digits.startsWith('-')
    digits = digits.replace(/-/g, '')
    digits = digits.replace(/^0+(?=\d)/, '') // sin ceros a la izquierda

    if (!digits) {
      setDisplay('')
      aplicar(null)
      return
    }

    const n = Number(digits) * (negativo ? -1 : 1)
    const formateado = (negativo ? '-' : '') + thousands.format(Math.abs(n))
    setDisplay(formateado)
    aplicar(n)

    // Reposiciona el cursor contando desde el final, para no saltar al
    // final del input cada vez que se agrega un separador de miles.
    requestAnimationFrame(() => {
      const el = innerRef.current
      if (!el) return
      const pos = Math.max(0, formateado.length - cursorDesde)
      el.setSelectionRange(pos, pos)
    })
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const texto = e.clipboardData.getData('text')
    try {
      const n = parsePesos(texto)
      aplicar(n)
      setDisplay(n != null ? thousands.format(n) : '')
    } catch {
      // parsePesos tira si hay centavos reales — se ignora el pegado inválido,
      // el onBlur/validación del formulario es quien muestra el error.
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Nunca cambiar el valor con la rueda del mouse (aunque sea type="text").
    ;(e.target as HTMLInputElement).blur()
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold pointer-events-none select-none">$</span>
        <input
          ref={setRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          disabled={disabled || loading}
          required={required}
          value={display}
          onChange={handleChange}
          onPaste={handlePaste}
          onWheel={handleWheel}
          onFocus={(e) => e.target.select()}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={`w-full min-h-[44px] pl-8 pr-4 py-3 bg-white/5 border rounded-xl text-white text-sm font-bold tabular-nums outline-none transition-all disabled:opacity-50 ${
            error ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-[#FDE047]/50'
          }`}
        />
      </div>
      {chips && chips.length > 0 && (
        <div className="flex gap-2 mt-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => aplicar(c.value)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
                value === c.value ? 'bg-[#FDE047] text-black border-[#FDE047]' : 'bg-white/5 text-gray-300 border-white/10 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p id={`${inputId}-error`} className="text-[11px] text-red-400 mt-1.5">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[11px] text-gray-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
})

export default MoneyInput

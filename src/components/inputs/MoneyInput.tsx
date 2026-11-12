import { useState, useEffect, useRef, forwardRef } from 'react'
import { montoTipeado, montoPegado, montoDisplay } from '../../lib/monto'

/**
 * Único input permitido para montos en toda la app (Tarea 2, guía
 * "Inputs, validación y formateo unificado"). Nunca un `<input type="number">`
 * a mano: sin flechas, sin ceros a la izquierda, formatea miles en vivo
 * manteniendo el cursor, acepta pegado ("$1.089.000,00" -> 1089000), bloquea
 * letras y la rueda del mouse. Devuelve un número o `null` (vacío ≠ 0).
 *
 * El formato es el argentino y vive entero en `lib/monto.ts` (nov 2026): el
 * punto es separador de miles y lo pone el input solo (la tecla punto se
 * ignora), la coma habilita hasta dos decimales. Un solo comportamiento para
 * TODOS los montos de la app — no hay más modo "con decimales" aparte.
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
  /** Símbolo a la izquierda. Default "$" — "US$" para montos en dólares (31/10/2026). */
  simbolo?: string
  className?: string
  id?: string
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  {
    label, hint, error, value, onChange, onBlur, min, max, permitirNegativo = false, permitirCero = true,
    placeholder = '0', disabled, loading, required, chips, className = '', id, simbolo = '$',
  },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)
  const [display, setDisplay] = useState(value != null ? montoDisplay(value) : '')
  const autoId = useRef(`money-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => {
    // No se repinta si el display actual ya representa ese mismo valor:
    // "340.000," vale 340000 y reformatear le borraría al usuario la coma
    // recién tipeada.
    if (montoTipeado(display, permitirNegativo).valor === value) return
    setDisplay(value != null ? montoDisplay(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // El cursor se cuenta DESDE EL FINAL: así no salta cada vez que
    // aparece o desaparece un separador de miles delante de él, y se puede
    // borrar o editar en el medio del número sin romperlo.
    const cursorDesde = raw.length - input.selectionStart!

    const { display: formateado, valor } = montoTipeado(raw, permitirNegativo)
    setDisplay(formateado)
    aplicar(valor)

    requestAnimationFrame(() => {
      const el = innerRef.current
      if (!el) return
      const pos = Math.max(0, formateado.length - cursorDesde)
      el.setSelectionRange(pos, pos)
    })
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    // Pegado de afuera: ahí sí "340000.00" es un decimal (así lo imprime la
    // Z del controlador fiscal), mientras "3.150.000" sigue siendo miles.
    const n = montoPegado(e.clipboardData.getData('text'))
    aplicar(n)
    setDisplay(n != null ? montoDisplay(n) : '')
  }

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Nunca cambiar el valor con la rueda del mouse (aunque sea type="text").
    ;(e.target as HTMLInputElement).blur()
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}{required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2 text-base md:text-body font-semibold pointer-events-none select-none">{simbolo}</span>
        <input
          ref={setRef}
          id={inputId}
          type="text"
          inputMode="decimal"
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
          className={`field ${simbolo.length > 1 ? 'pl-12' : 'pl-8'} pr-4 tabular-nums  ${
            error ? 'field-error' : ''
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
              className={`flex-1 sm:flex-none px-3 py-2 rounded-full text-label border transition-all min-h-[44px] ${
                value === c.value ? 'bg-ink text-on-ink border-ink' : 'bg-surface text-ink-2 border-line hover:text-ink'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p id={`${inputId}-error`} className="text-label text-danger mt-2">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-label text-ink-2 mt-2">{hint}</p>
      ) : null}
    </div>
  )
})

export default MoneyInput

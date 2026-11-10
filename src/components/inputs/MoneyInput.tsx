import { useState, useEffect, useRef, forwardRef } from 'react'
import { parsePesos } from '../../lib/parse'

const thousands = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

// Modo `decimales` (nov 2026, Total Z del controlador fiscal): el único monto
// de la app que llega con centavos ("340000.00"). Todo lo demás sigue siendo
// entero, igual que siempre — el modo es opt-in y no cambia nada sin la prop.
const MAX_DEC = 2

/** Texto tipeado -> { display, valor } en modo decimales. */
function parseConDecimales(raw: string, permitirNegativo: boolean): { display: string; valor: number | null } {
  const limpio = raw.replace(permitirNegativo ? /[^\d,.-]/g : /[^\d,.]/g, '').replace(/\./g, ',')
  const negativo = permitirNegativo && limpio.trimStart().startsWith('-')
  const sinSigno = limpio.replace(/-/g, '')
  const coma = sinSigno.indexOf(',')
  const enteroRaw = (coma === -1 ? sinSigno : sinSigno.slice(0, coma)).replace(/,/g, '')
  const decRaw = coma === -1 ? null : sinSigno.slice(coma + 1).replace(/,/g, '').slice(0, MAX_DEC)
  const entero = enteroRaw.replace(/^0+(?=\d)/, '')
  if (!entero && decRaw === null) return { display: negativo ? '-' : '', valor: null }
  const signo = negativo ? '-' : ''
  const display = signo + thousands.format(Number(entero || 0)) + (decRaw === null ? '' : `,${decRaw}`)
  const valor = Number(`${signo}${entero || 0}.${(decRaw || '0').padEnd(MAX_DEC, '0')}`)
  return { display, valor }
}

/** Número -> texto con miles y, si tiene centavos, exactamente dos decimales. */
function formatDecimales(n: number): string {
  const redondeado = Math.round(n * 100) / 100
  const entero = Math.trunc(Math.abs(redondeado))
  const centavos = Math.round((Math.abs(redondeado) - entero) * 100)
  const signo = redondeado < 0 ? '-' : ''
  return signo + thousands.format(entero) + (centavos ? `,${String(centavos).padStart(2, '0')}` : '')
}

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
  /** Símbolo a la izquierda. Default "$" — "US$" para montos en dólares (31/10/2026). */
  simbolo?: string
  /** Acepta centavos (dos decimales). Solo el Total Z de la caja lo usa. */
  decimales?: boolean
  className?: string
  id?: string
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  {
    label, hint, error, value, onChange, onBlur, min, max, permitirNegativo = false, permitirCero = true,
    placeholder = '0', disabled, loading, required, chips, className = '', id, simbolo = '$',
    decimales = false,
  },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)
  const formatear = (n: number) => (decimales ? formatDecimales(n) : thousands.format(n))
  const [display, setDisplay] = useState(value != null ? formatear(value) : '')
  const autoId = useRef(`money-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => {
    // No se repinta si el display actual ya representa ese mismo valor: en modo
    // decimales "340.000," vale 340000 y reformatear le borraria la coma recien
    // tipeada al usuario.
    const actual = decimales ? parseConDecimales(display, permitirNegativo).valor : null
    if (decimales && actual === value) return
    setDisplay(value != null ? formatear(value) : '')
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
    const cursorDesde = raw.length - input.selectionStart!

    if (decimales) {
      const { display: formateado, valor } = parseConDecimales(raw, permitirNegativo)
      setDisplay(formateado)
      aplicar(valor)
      requestAnimationFrame(() => {
        const el = innerRef.current
        if (!el) return
        const pos = Math.max(0, formateado.length - cursorDesde)
        el.setSelectionRange(pos, pos)
      })
      return
    }

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
    if (decimales) {
      // parsePesos tira con centavos reales, que acá son validos: se pega tal cual.
      const { display: formateado, valor } = parseConDecimales(texto, permitirNegativo)
      setDisplay(formateado)
      aplicar(valor)
      return
    }
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
          inputMode={decimales ? 'decimal' : 'numeric'}
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

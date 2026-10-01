import { useState, useEffect, useRef } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import 'react-day-picker/style.css'
import { formatFecha } from '../../lib/format'
import { parseFecha } from '../../lib/parse'

/**
 * Único input permitido para fechas en toda la app. Nunca un
 * `<input type="date">` nativo: tipeable "dd/mm/aaaa", con un calendario
 * (react-day-picker, locale es, semana arranca lunes) como asistencia — no
 * como único método de carga. `value`/`onChange` viajan en "yyyy-mm-dd"
 * (mismo formato que las columnas `date` de Postgres) o `null`.
 *
 * Uso: <DateInput label="Fecha" value={fecha} onChange={setFecha} max={hoy} />
 * Con días ocupados tachados: pasar `disabledRanges={[{from,to}, ...]}`.
 */
export interface DateInputProps {
  label?: string
  hint?: string
  error?: string
  value: string | null // "yyyy-mm-dd"
  onChange: (iso: string | null) => void
  onBlur?: () => void
  min?: string
  max?: string
  disabledRanges?: { from: string; to: string }[]
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
}

function isoToDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(d: Date | undefined): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export default function DateInput({
  label, hint, error, value, onChange, onBlur, min, max, disabledRanges, required, disabled, placeholder = 'dd/mm/aaaa', className = '', id,
}: DateInputProps) {
  const [texto, setTexto] = useState(value ? formatFecha(value) : '')
  const [abierto, setAbierto] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const autoId = useRef(`date-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => setTexto(value ? formatFecha(value) : ''), [value])

  useEffect(() => {
    if (!abierto) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [abierto])

  const handleTextBlur = () => {
    const iso = parseFecha(texto)
    onChange(iso)
    setTexto(iso ? formatFecha(iso) : texto)
    onBlur?.()
  }

  const disabledMatcher = [
    ...(min ? [{ before: isoToDate(min)! }] : []),
    ...(max ? [{ after: isoToDate(max)! }] : []),
    ...(disabledRanges || []).map((r) => ({ from: isoToDate(r.from)!, to: isoToDate(r.to)! })),
  ]

  return (
    <div className={className} ref={wrapRef}>
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
          enterKeyHint="done"
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          aria-invalid={!!error}
          className={`w-full min-h-[44px] pl-4 pr-10 py-3 bg-white/5 border rounded-xl text-white text-sm font-bold outline-none transition-all disabled:opacity-50 ${
            error ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-[#FDE047]/50'
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setAbierto((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-[#FDE047] transition-colors"
        >
          <CalendarDays size={18} />
        </button>

        {abierto && (
          <div className="absolute z-50 mt-2 top-full left-0 bg-[#111520] border border-white/10 rounded-2xl shadow-2xl p-2 dp-dark">
            <DayPicker
              mode="single"
              locale={es}
              weekStartsOn={1}
              selected={isoToDate(value)}
              disabled={disabledMatcher}
              onSelect={(d) => { onChange(dateToIso(d)); setTexto(d ? formatFecha(dateToIso(d)) : ''); setAbierto(false) }}
            />
          </div>
        )}
      </div>
      {error ? <p className="text-[11px] text-red-400 mt-1.5">{error}</p> : hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}

      {/* Recoloreado mínimo del calendario para el tema Glass Dark — react-day-picker
          trae su propio style.css claro, se sobreescriben solo los colores. */}
      <style>{`
        .dp-dark .rdp-root { --rdp-accent-color: #FDE047; --rdp-accent-background-color: rgba(253,224,71,0.15); color: #fff; }
        .dp-dark .rdp-day_button:hover { background: rgba(255,255,255,0.08); }
        .dp-dark .rdp-selected .rdp-day_button { background: #FDE047; color: #000; font-weight: 700; }
        .dp-dark .rdp-disabled { opacity: 0.3; text-decoration: line-through; }
        .dp-dark .rdp-weekday { color: rgba(255,255,255,0.4); }
        .dp-dark .rdp-caption_label, .dp-dark .rdp-nav button { color: #fff; }
      `}</style>
    </div>
  )
}

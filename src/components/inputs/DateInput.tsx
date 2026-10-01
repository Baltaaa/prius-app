import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
 * El popover se renderiza en un portal a document.body (fixed, no absolute)
 * — así nunca queda recortado por un contenedor con scroll/overflow-hidden
 * (ej. el acordeón "Cargar comprobante ahora" de RegistrarPago.jsx), y
 * siempre queda por encima de cualquier modal (Modal.jsx usa z-[999]).
 *
 * `calendarOnly` (opt-in, default false — no cambia el comportamiento de los
 * demás usos): el input queda readOnly (no se tipea), se abre tocando
 * cualquier parte del campo, y mientras está abierto un backdrop bloquea el
 * resto de la pantalla — hay que elegir una fecha o cerrarlo a propósito.
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
  calendarOnly?: boolean
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

type Pos = { top: number; left: number; width: number }

export default function DateInput({
  label, hint, error, value, onChange, onBlur, min, max, disabledRanges, required, disabled,
  placeholder = 'dd/mm/aaaa', className = '', id, calendarOnly = false,
}: DateInputProps) {
  const [texto, setTexto] = useState(value ? formatFecha(value) : '')
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const autoId = useRef(`date-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => setTexto(value ? formatFecha(value) : ''), [value])

  const medirPosicion = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })
  }, [])

  const abrir = useCallback(() => {
    if (disabled) return
    medirPosicion()
    setAbierto(true)
  }, [disabled, medirPosicion])

  useEffect(() => {
    if (!abierto) return
    medirPosicion()
    window.addEventListener('resize', medirPosicion)
    window.addEventListener('scroll', medirPosicion, true)
    return () => {
      window.removeEventListener('resize', medirPosicion)
      window.removeEventListener('scroll', medirPosicion, true)
    }
  }, [abierto, medirPosicion])

  // Click afuera cierra — solo en modo tipeable. En calendarOnly el backdrop
  // a pantalla completa es el único cierre "implícito" (más visible/explícito
  // que un simple outside-click, que acá se evita a propósito).
  useEffect(() => {
    if (!abierto || calendarOnly) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [abierto, calendarOnly])

  // onKeyDown en vez de un listener en document: así el Escape se frena acá
  // (stopPropagation) y no sigue de largo hasta el listener de Modal.jsx,
  // que también escucha Escape en document y cerraría el modal entero. Los
  // portals de React burbujean por el árbol de React, no por el DOM físico,
  // así que esto también agarra el Escape apretado adentro del calendario
  // (otro <div> montado en document.body).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (abierto && e.key === 'Escape') {
      e.stopPropagation()
      setAbierto(false)
    }
  }

  const handleTextBlur = () => {
    if (calendarOnly) return
    const iso = parseFecha(texto)
    onChange(iso)
    setTexto(iso ? formatFecha(iso) : texto)
    onBlur?.()
  }

  const handleSelect = (d: Date | undefined) => {
    const iso = dateToIso(d)
    onChange(iso)
    setTexto(iso ? formatFecha(iso) : '')
    setAbierto(false)
  }

  const disabledMatcher = [
    ...(min ? [{ before: isoToDate(min)! }] : []),
    ...(max ? [{ after: isoToDate(max)! }] : []),
    ...(disabledRanges || []).map((r) => ({ from: isoToDate(r.from)!, to: isoToDate(r.to)! })),
  ]

  return (
    <div className={className} onKeyDown={handleKeyDown}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative" ref={wrapRef}>
        <input
          id={inputId}
          type="text"
          inputMode={calendarOnly ? undefined : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          readOnly={calendarOnly}
          disabled={disabled}
          required={required}
          value={texto}
          onChange={calendarOnly ? undefined : (e) => setTexto(e.target.value)}
          onFocus={abrir}
          onClick={calendarOnly ? abrir : undefined}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          aria-invalid={!!error}
          className={`w-full min-h-[44px] pl-4 pr-10 py-3 bg-white/5 border rounded-xl text-white text-sm font-bold outline-none transition-all disabled:opacity-50 ${
            calendarOnly ? 'cursor-pointer' : ''
          } ${error ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-[#FDE047]/50'}`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-[#FDE047] transition-colors"
        >
          <CalendarDays size={18} />
        </button>
      </div>
      {error ? <p className="text-[11px] text-red-400 mt-1.5">{error}</p> : hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}

      {abierto && pos && createPortal(
        <>
          {calendarOnly && (
            <div className="fixed inset-0 z-[1000] bg-black/60" onClick={() => setAbierto(false)} />
          )}
          <div
            className="fixed z-[1001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0
                       bg-[#111520] border border-white/10 rounded-2xl shadow-2xl p-2 dp-dark"
            style={window.innerWidth >= 640 ? { top: pos.top, left: pos.left, minWidth: pos.width } : undefined}
          >
            <DayPicker
              mode="single"
              locale={es}
              weekStartsOn={1}
              selected={isoToDate(value)}
              defaultMonth={isoToDate(value) || new Date()}
              disabled={disabledMatcher}
              onSelect={handleSelect}
            />
          </div>
        </>,
        document.body,
      )}

      {/* Recoloreado mínimo del calendario — react-day-picker trae su propio
          style.css claro, se sobreescriben solo los colores (Quiet Luxury). */}
      <style>{`
        .dp-dark .rdp-root { --rdp-accent-color: #F2CA50; --rdp-accent-background-color: rgba(242,202,80,0.15); color: #fff; }
        .dp-dark .rdp-day_button:hover { background: rgba(255,255,255,0.08); }
        .dp-dark .rdp-selected .rdp-day_button { background: #F2CA50; color: #000; font-weight: 700; }
        .dp-dark .rdp-disabled { opacity: 0.3; text-decoration: line-through; }
        .dp-dark .rdp-weekday { color: rgba(255,255,255,0.4); }
        .dp-dark .rdp-caption_label, .dp-dark .rdp-nav button { color: #fff; }
      `}</style>
    </div>
  )
}

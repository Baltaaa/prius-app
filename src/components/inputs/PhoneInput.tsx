import { useState, useEffect, useRef } from 'react'
import { formatTelefono } from '../../lib/format'
import { parseTelefono } from '../../lib/parse'

/**
 * Teléfono con Argentina por defecto: mientras se escribe se ve tal cual, al
 * salir del campo se normaliza a E.164 y se muestra formateado
 * ("+54 9 223 512-3456"). Guarda siempre E.164 vía onChange.
 *
 * Nota: el selector de país completo del prompt original se simplificó a
 * "AR por defecto, pega/escribe cualquier formato local" — no hay UI de
 * bandera/código de país todavía (pendiente si se necesitan clientes del
 * exterior con frecuencia).
 *
 * Uso: <PhoneInput label="Teléfono" value={telefonoE164} onChange={setTelefono} required />
 */
export interface PhoneInputProps {
  label?: string
  hint?: string
  error?: string
  value: string | null
  onChange: (e164: string | null) => void
  onBlur?: () => void
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export default function PhoneInput({ label, hint, error, value, onChange, onBlur, required, disabled, className = '', id }: PhoneInputProps) {
  const [texto, setTexto] = useState(value ? formatTelefono(value) : '')
  const [editando, setEditando] = useState(false)
  const autoId = useRef(`phone-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  useEffect(() => {
    if (!editando) setTexto(value ? formatTelefono(value) : '')
  }, [value, editando])

  const handleBlur = () => {
    setEditando(false)
    const e164 = parseTelefono(texto)
    onChange(e164)
    setTexto(e164 ? formatTelefono(e164) : texto)
    onBlur?.()
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        enterKeyHint="next"
        autoComplete="tel"
        disabled={disabled}
        required={required}
        value={texto}
        onFocus={() => setEditando(true)}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={handleBlur}
        placeholder="Ej: 223 512-3456"
        aria-invalid={!!error}
        className={`w-full min-h-[44px] px-4 py-3 bg-white/5 border rounded-xl text-white text-sm font-bold outline-none transition-all disabled:opacity-50 ${
          error ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-[#FDE047]/50'
        }`}
      />
      {error ? <p className="text-[11px] text-red-400 mt-1.5">{error}</p> : hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}
    </div>
  )
}

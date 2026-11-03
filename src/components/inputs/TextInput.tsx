import { useState, useEffect, useRef } from 'react'

/**
 * Input/TextArea de texto libre con trim al salir del campo, colapso de
 * espacios dobles y contador de caracteres cuando hay `maxLength`.
 *
 * Uso: <TextInput label="Concepto" value={v} onChange={setV} maxLength={120} required />
 *      <TextInput as="textarea" rows={3} label="Notas" value={v} onChange={setV} maxLength={500} />
 */
export interface TextInputProps {
  label?: string
  hint?: string
  error?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  as?: 'input' | 'textarea'
  rows?: number
  maxLength?: number
  placeholder?: string
  required?: boolean
  disabled?: boolean
  type?: string
  className?: string
  id?: string
}

export default function TextInput({
  label, hint, error, value, onChange, onBlur, as = 'input', rows = 3, maxLength, placeholder, required, disabled,
  type = 'text', className = '', id,
}: TextInputProps) {
  const autoId = useRef(`text-${Math.random().toString(36).slice(2, 9)}`).current
  const inputId = id || autoId

  const handleBlur = () => {
    const limpio = value.trim().replace(/\s{2,}/g, ' ')
    if (limpio !== value) onChange(limpio)
    onBlur?.()
  }

  const commonProps = {
    id: inputId,
    disabled,
    required,
    value,
    maxLength,
    placeholder,
    onBlur: handleBlur,
    'aria-invalid': !!error,
    className: `field resize-none ${
      error ? 'field-error' : ''
    }`,
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {as === 'textarea' ? (
        <textarea rows={rows} onChange={(e) => onChange(e.target.value)} {...commonProps} />
      ) : (
        <input type={type} enterKeyHint="next" onChange={(e) => onChange(e.target.value)} {...commonProps} />
      )}
      <div className="flex justify-between mt-1.5">
        {error ? (
          <p className="text-label text-danger">{error}</p>
        ) : hint ? (
          <p className="text-label text-ink-2">{hint}</p>
        ) : <span />}
        {maxLength && <p className="text-label text-ink-2 tabular-nums shrink-0">{value.length}/{maxLength}</p>}
      </div>
    </div>
  )
}

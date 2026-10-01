import { Search, X } from 'lucide-react'

/**
 * Input de búsqueda con ícono y botón limpiar. El debounce (250ms) y el
 * mínimo de 2 caracteres para disparar la búsqueda quedan del lado del
 * llamador (ver `useDebounced` + el gate de largo en TopBar.jsx) — este
 * componente es solo la UI del campo, reutilizable en cualquier pantalla.
 *
 * Uso: <SearchInput value={q} onChange={setQ} placeholder="Buscar..." />
 */
export interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
}

export default function SearchInput({ value, onChange, placeholder = 'Buscar...', autoFocus, className = '', inputClassName = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-10 pr-10 min-h-[44px] py-2 bg-white/5 border border-white/10 focus:border-white/30 outline-none text-sm rounded-lg text-white placeholder-gray-500 transition-all ${inputClassName}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-gray-500 hover:text-white transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

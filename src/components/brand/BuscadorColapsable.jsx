import { useId, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import SearchInput from '../inputs/SearchInput'
import { useOverlay } from '../../context/OverlayProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// Buscador de toolbar. Desde 1280px (y en mobile) es el campo normal; entre
// 768 y 1279px la fila no alcanza para todo y se colapsa a un ícono de 40px que
// se expande al hacer click (flotando sobre los controles siguientes, así la
// toolbar sigue en dos filas). Click afuera o Escape lo cierran.
export default function BuscadorColapsable({ value, onChange, placeholder, className = '' }) {
  const ancho = useMediaQuery('(min-width: 1280px)')
  const mobile = !useMediaQuery('(min-width: 768px)')
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const inputRef = useRef(null)
  const anclaRef = useRef(null)
  const { bind } = useOverlay({ id: `buscador-${id}`, isOpen: abierto, onRequestClose: () => setAbierto(false) })

  if (ancho || mobile) {
    return <SearchInput value={value} onChange={onChange} placeholder={placeholder} className={className} />
  }
  return (
    <div ref={(el) => { anclaRef.current = el; bind(el) }} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setAbierto(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        aria-label="Buscar"
        title="Buscar"
        aria-expanded={abierto}
        className={`btn btn-secondary h-10 w-10 min-h-0 px-0 ${value ? 'ring-1 ring-gold' : ''}`}
      >
        <Search size={16} strokeWidth={1.5} />
      </button>
      {abierto && (
        <div className="absolute left-0 top-0 z-30 w-80 ui-open">
          <SearchInput ref={inputRef} value={value} onChange={onChange} placeholder={placeholder} autoFocus />
        </div>
      )}
    </div>
  )
}

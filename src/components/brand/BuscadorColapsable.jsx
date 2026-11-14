import { useId, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import SearchInput from '../inputs/SearchInput'
import PopoverAnclado from '../ui/PopoverAnclado'
import { useOverlay } from '../../context/OverlayProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// Buscador de la barra única (PageTopbar). Desde 1280px es el campo normal;
// por debajo la fila no alcanza para todo y se colapsa a un botón ícono de
// 40px que se expande al hacer click. Click afuera o Escape lo cierran.
//
// El campo expandido va en PopoverAnclado (portal): un `absolute` adentro de
// la fila de controles quedaría cortado por su overflow y su mask-image.
export default function BuscadorColapsable({ value, onChange, placeholder, className = '' }) {
  const ancho = useMediaQuery('(min-width: 1280px)')
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const inputRef = useRef(null)
  const anclaRef = useRef(null)
  const { bind } = useOverlay({ id: `buscador-${id}`, isOpen: abierto, onRequestClose: () => setAbierto(false) })

  if (ancho) {
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
        className={`pill-control pill-control-icono ${value ? 'ring-1 ring-gold' : ''}`}
      >
        <Search size={16} strokeWidth={1.5} />
      </button>
      {abierto && (
        <PopoverAnclado ref={bind} anchorRef={anclaRef} width={320} scroll={false} className="p-2" role="search">
          <SearchInput ref={inputRef} value={value} onChange={onChange} placeholder={placeholder} autoFocus />
        </PopoverAnclado>
      )}
    </div>
  )
}

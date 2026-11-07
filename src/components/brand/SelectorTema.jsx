import { Moon } from 'lucide-react'
import SegmentedControl from './SegmentedControl'
import { useTema } from '../../context/TemaProvider'
import { OPCIONES_TEMA } from '../../lib/tema'

// Selector de tema Claro / Oscuro / Sistema (Mi cuenta y sheet "Más").
export default function SelectorTema({ className = '', fullWidth = true }) {
  const { preferencia, elegir } = useTema()
  return <SegmentedControl label="Tema" options={OPCIONES_TEMA} value={preferencia} onChange={elegir} fullWidth={fullWidth} className={className} />
}

// Toggle rápido del menú de perfil: alterna claro/oscuro (desde "Sistema" fija
// el opuesto al que se está viendo).
export function ToggleTema({ className = '' }) {
  const { resuelto, alternar } = useTema()
  const oscuro = resuelto === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={oscuro}
      onClick={alternar}
      className={`w-full text-left px-4 py-3 text-label text-ink-2 hover:bg-surface flex items-center gap-2 rounded-icon ${className}`}
    >
      <Moon size={14} />
      <span className="flex-1">Modo oscuro</span>
      <span aria-hidden className={`relative w-9 h-5 rounded-full anim-colors ${oscuro ? 'bg-ink' : 'bg-line'}`}>
        <span className={`absolute top-1 left-1 w-3 h-3 rounded-full transition-transform duration-200 ${oscuro ? 'translate-x-4 bg-on-ink' : 'bg-ink-2'}`} />
      </span>
    </button>
  )
}

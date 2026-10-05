import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, Check } from 'lucide-react'
import { normalizeText } from '../../lib/format'

export type BrandSelectOption = {
  value: string
  label: string
  group?: string
  disabled?: boolean
}

type BrandSelectProps = {
  value: string
  onChange: (value: string) => void
  options: BrandSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  searchable?: boolean
  disabled?: boolean
  error?: string
  invalid?: boolean
  className?: string
}

const SEARCH_THRESHOLD = 10

// Combobox propio del CRM (ítem 1 del masterprompt de UI/UX) — reemplaza
// TODO <select> nativo de la app, sin excepción: el menú desplegable de un
// <select> lo dibuja el sistema operativo, no se puede estilizar con CSS.
// No hay Radix/cmdk instalados en el proyecto (los archivos en components/ui/
// eran scaffolding sin usar, nunca se agregaron como dependencia real) —
// armado a mano con el mismo patrón que Modal.jsx/ClienteSelector.jsx:
// portal a document.body (position: fixed adentro de un ancestro con
// `transform` queda atrapado, no cubre el viewport), bottom sheet en mobile,
// fondo opaco (nunca glass-card: un panel flotante encima de contenido no
// puede ser semi-transparente — bug real que tenía ClienteSelector).
export default function BrandSelect({
  value, onChange, options, placeholder = 'Seleccionar...', searchPlaceholder = 'Buscar...',
  searchable, disabled, error, invalid, className = '',
}: BrandSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  // Match por tokens (no substring único): "carpa 70" tiene que encontrar
  // "🏠 carpa #70" aunque el "#" rompa el substring literal — cada palabra
  // del término buscado tiene que aparecer en algún lado del label.
  const filtered = useMemo(() => {
    const tokens = normalizeText(search).trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return options
    return options.filter((o) => {
      const label = normalizeText(o.label)
      return tokens.every((t) => label.includes(t))
    })
  }, [options, search])

  const groups = useMemo(() => {
    const map = new Map<string, BrandSelectOption[]>()
    for (const o of filtered) {
      const key = o.group || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return [...map.entries()]
  }, [filtered])

  const showSearch = searchable || options.length > SEARCH_THRESHOLD

  const computePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelHeight = Math.min(320, filtered.length * 40 + (showSearch ? 48 : 0) + 16)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < panelHeight && rect.top > panelHeight
    setCoords({
      top: openUp ? rect.top - panelHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    })
  }

  const handleOpen = () => {
    if (disabled) return
    setSearch('')
    setHighlight(Math.max(0, filtered.findIndex((o) => o.value === value)))
    computePosition()
    setOpen(true)
  }

  useEffect(() => {
    if (!open || isMobile) return
    const onScrollOrResize = () => computePosition()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile])

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus()
  }, [open, showSearch])

  useEffect(() => {
    setHighlight(0)
  }, [search])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-idx="${highlight}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const selectAt = (idx: number) => {
    const opt = filtered[idx]
    if (!opt || opt.disabled) return
    onChange(opt.value)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectAt(highlight)
    } else if (!showSearch && e.key.length === 1) {
      // Typeahead sin buscador (listas chicas): salta al primer ítem que
      // empieza con la letra tipeada, como un <select> nativo.
      const term = normalizeText(e.key)
      const idx = filtered.findIndex((o) => normalizeText(o.label).startsWith(term))
      if (idx >= 0) setHighlight(idx)
    }
  }

  const triggerClass = `w-full min-h-[44px] flex items-center justify-between gap-2 bg-white/5 border rounded-xl px-4 py-3 text-sm text-left outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
    error || invalid ? 'border-red-500/50' : open ? 'border-[#FDE047]/50' : 'border-white/10'
  } ${className}`

  let flatIdx = -1

  const renderList = () => (
    <div ref={listRef} className="overflow-y-auto scrollbar-thin" style={{ maxHeight: isMobile ? undefined : 320 }}>
      {filtered.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-500 uppercase tracking-widest">Sin resultados</p>
      ) : (
        groups.map(([group, opts]) => (
          <div key={group || '_'}>
            {group && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{group}</p>
            )}
            {opts.map((o) => {
              flatIdx += 1
              const idx = flatIdx
              const isSelected = o.value === value
              const isHighlighted = idx === highlight
              return (
                <button
                  key={o.value}
                  type="button"
                  data-idx={idx}
                  disabled={o.disabled}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => selectAt(idx)}
                  // Hover/activo: fondo sutil blanco, NUNCA rojo (eso era el
                  // menú nativo del sistema operativo pintando su propio
                  // estado, no algo que este componente controle).
                  className={`w-full flex items-center justify-between gap-2 text-left px-4 py-2.5 text-sm font-bold transition-all min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed ${
                    isSelected ? 'text-[#F2CA50]' : 'text-white'
                  } ${isHighlighted ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-[#F2CA50]" />}
                </button>
              )
            })}
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        onKeyDown={handleKeyDown}
        className={triggerClass}
      >
        <span className={`truncate uppercase font-bold ${selected ? 'text-white' : 'text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !isMobile && coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[1000]" onClick={() => setOpen(false)} />
            <div
              onKeyDown={handleKeyDown}
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
              className="z-[1001] bg-[#0a0d14] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              {showSearch && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
                  <Search size={14} className="text-gray-500 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                  />
                </div>
              )}
              {renderList()}
            </div>
          </>,
          document.body,
        )}

      {open && isMobile &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              className="w-full max-h-[80vh] bg-[#0a0d14] border-t border-white/10 rounded-t-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {showSearch && (
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
                  <Search size={14} className="text-gray-500 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                  />
                </div>
              )}
              {renderList()}
            </div>
          </div>,
          document.body,
        )}

      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

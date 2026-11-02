import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { useData } from '../../context/DataProvider'
import { normalizeText, formatUnidad, unidadEmoji } from '../../lib/format'
import { validarClienteForm } from '../../lib/validators/cliente'
import TextInput from '../inputs/TextInput'
import PhoneInput from '../inputs/PhoneInput'
import DniInput from '../inputs/DniInput'
import CuitInput from '../inputs/CuitInput'

// Buscador de clientes inline — reemplaza ClienteSelector en toda la app:
// Asignar carpa, Nueva reserva, Cosocios, Registrar pago.
//
// Diferencias clave vs ClienteSelector (que usaba portal flotante):
//   - Panel de resultados inline: empuja el contenido, no flota.
//   - ≥2 chars para mostrar resultados (máx 6, orden por relevancia).
//   - Chip al seleccionar: avatar + nombre + unidad vigente + X para limpiar.
//   - Teclado: flechas, Enter, Escape (Escape cierra resultados, NO el modal).
//   - "+ Nuevo" abre formulario inline; auto-selecciona al guardar.
export default function ClienteBuscador({ value, onChange, autoFocus }) {
  const { clientes, reservas = [], unidades = [], createCliente } = useData()

  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [showNuevo, setShowNuevo] = useState(false)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  // Inline form state
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState(null)
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [mail, setMail] = useState('')
  const [saving, setSaving] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [error, setError] = useState('')

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === value) || null,
    [clientes, value],
  )

  // Unidad vigente por cliente (primera reserva activa o preconfirmada)
  const unidadPorCliente = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      if ((r.estado === 'activa' || r.estado === 'preconfirmada') && r.unidad_id && !map[r.cliente_id]) {
        const u = unidades.find((un) => un.id === r.unidad_id)
        if (u) map[r.cliente_id] = `${unidadEmoji(u.tipo)} ${formatUnidad(u.tipo, u.numero)}`
      }
    }
    return map
  }, [reservas, unidades])

  // Resultados filtrados y ordenados por relevancia (empieza con el term primero)
  const resultados = useMemo(() => {
    const term = normalizeText(query).trim()
    if (term.length < 2) return []
    const filtrados = clientes.filter((c) => normalizeText(c.nombre).includes(term))
    filtrados.sort((a, b) => {
      const aN = normalizeText(a.nombre)
      const bN = normalizeText(b.nombre)
      return (aN.startsWith(term) ? 0 : 1) - (bN.startsWith(term) ? 0 : 1) || aN.localeCompare(bN)
    })
    return filtrados.slice(0, 6)
  }, [clientes, query])

  // Click outside cierra panel de resultados
  useEffect(() => {
    if (!showResults) return
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setShowResults(false)
        setFocusedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showResults])

  const handleSelect = (cliente) => {
    onChange(cliente.id, cliente)
    setQuery('')
    setShowResults(false)
    setFocusedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (showResults) {
        // Escape cierra solo el panel de resultados, nunca el modal
        e.preventDefault()
        e.stopPropagation()
        setQuery('')
        setShowResults(false)
        setFocusedIndex(-1)
      }
      return
    }
    if (!showResults || resultados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      handleSelect(resultados[focusedIndex])
    }
  }

  const resetNuevo = () => {
    setShowNuevo(false)
    setNombre('')
    setTelefono(null)
    setDni('')
    setCuit('')
    setMail('')
    setIntentado(false)
    setError('')
  }

  const errorsNuevo = validarClienteForm({ nombre, telefono, condicionIva: 'consumidor_final', cuit: '', dni, mail })
  if (cuit && cuit.length !== 11) errorsNuevo.cuit = 'CUIT inválido'

  const handleGuardar = async () => {
    setIntentado(true)
    if (Object.keys(errorsNuevo).length > 0) return
    setSaving(true)
    setError('')
    try {
      const nuevo = await createCliente({
        nombre: nombre.trim().replace(/[´`]/g, "'").toUpperCase(),
        telefono: telefono || null,
        dni: dni || null,
        cuit: cuit || null,
        mail: mail || null,
      })
      onChange(nuevo.id, nuevo)
      resetNuevo()
    } catch (err) {
      setError(err.message || 'No se pudo crear el cliente.')
    } finally {
      setSaving(false)
    }
  }

  // — Estado: cliente seleccionado → chip —
  if (clienteSeleccionado && !showNuevo) {
    const unidadLabel = unidadPorCliente[clienteSeleccionado.id]
    const initials = clienteSeleccionado.nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
    return (
      <div className="flex items-center gap-3 p-3 bg-surface border border-line rounded-inner">
        <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0 select-none">
          <span className="text-on-ink text-xs font-bold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body font-bold text-ink truncate">{clienteSeleccionado.nombre}</p>
          {unidadLabel && <p className="text-xs text-ink-2 truncate">{unidadLabel}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('', null)
            setQuery('')
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-ink-2 hover:text-ink transition-all"
          aria-label="Quitar cliente"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  // — Estado: formulario nuevo cliente —
  if (showNuevo) {
    return (
      <div className="space-y-3 p-4 bg-surface border border-gold-300 rounded-inner">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-ink uppercase tracking-widest">Cliente Nuevo</p>
          <button
            type="button"
            onClick={resetNuevo}
            className="text-ink-2 hover:text-ink transition-all"
          >
            <X size={16} />
          </button>
        </div>
        <TextInput
          required
          placeholder="Nombre completo"
          value={nombre}
          onChange={(v) => setNombre(v.replace(/[´`]/g, "'").toUpperCase())}
          maxLength={120}
          error={intentado ? errorsNuevo.nombre : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <PhoneInput
            label="Teléfono"
            required
            value={telefono}
            onChange={setTelefono}
            error={intentado ? errorsNuevo.telefono : undefined}
          />
          <DniInput
            label="DNI (opcional)"
            value={dni}
            onChange={setDni}
            error={intentado ? errorsNuevo.dni : undefined}
          />
        </div>
        <CuitInput
          label="CUIT (opcional)"
          value={cuit}
          onChange={setCuit}
          error={intentado ? errorsNuevo.cuit : undefined}
        />
        <TextInput
          label="Email"
          type="email"
          placeholder="cliente@email.com"
          value={mail}
          onChange={(v) => setMail(v.toLowerCase())}
          error={intentado ? errorsNuevo.mail : undefined}
        />
        {error && <p className="text-[11px] text-danger">{error}</p>}
        <button
          type="button"
          onClick={handleGuardar}
          disabled={saving}
          className="w-full py-2.5 bg-gold hover:bg-gold-400 disabled:opacity-50 text-ink font-bold uppercase tracking-widest text-[10px] rounded-inner transition-all flex items-center justify-center gap-2"
        >
          <UserPlus size={14} />
          {saving ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </div>
    )
  }

  // — Estado: búsqueda —
  return (
    <div ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            autoFocus={autoFocus}
            autoComplete="off"
            placeholder="Buscar cliente por nombre..."
            value={query}
            onChange={(e) => {
              const v = e.target.value
              setQuery(v)
              setShowResults(v.length >= 2)
              if (v.length < 2) setFocusedIndex(-1)
            }}
            onFocus={() => {
              if (query.length >= 2) setShowResults(true)
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface border border-line rounded-inner pl-9 pr-4 py-3 text-ink text-base md:text-body focus:border-gold-300 outline-none uppercase font-bold"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNuevo(true)}
          className="px-3 py-3 bg-surface border border-line rounded-inner text-[10px] font-bold text-ink-2 hover:text-ink hover:border-gold-300 transition-all flex items-center gap-1.5 shrink-0 uppercase tracking-widest whitespace-nowrap"
        >
          <UserPlus size={14} />
          <span>+ Nuevo</span>
        </button>
      </div>

      {showResults && (
        <div className="mt-1 border border-line rounded-inner overflow-hidden bg-card">
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-xs text-ink-2 uppercase tracking-widest">Sin resultados</p>
          ) : (
            resultados.map((c, i) => {
              const unidadLabel = unidadPorCliente[c.id]
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-all ${
                    i > 0 ? 'border-t border-line' : ''
                  } ${i === focusedIndex ? 'bg-surface' : 'hover:bg-surface'}`}
                >
                  <span className="text-body text-ink font-bold uppercase truncate">{c.nombre}</span>
                  {unidadLabel && (
                    <span className="text-xs text-ink-2 shrink-0">{unidadLabel}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

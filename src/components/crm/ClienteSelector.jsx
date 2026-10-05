import { useState, useMemo } from 'react'
import { UserPlus, X } from 'lucide-react'
import { useData } from '../../context/DataProvider'
import { normalizeText } from '../../lib/format'
import { validarClienteForm } from '../../lib/validators/cliente'
import TextInput from '../inputs/TextInput'
import PhoneInput from '../inputs/PhoneInput'
import DniInput from '../inputs/DniInput'
import CuitInput from '../inputs/CuitInput'

// Combobox de cliente + alta inline ("Crear cliente nuevo") — componente
// único para toda la app (oct 2026): antes Reservas.jsx tenía su propia copia
// sin validar; el Plano necesitaba el mismo flujo para asignar una unidad.
// Mismas reglas de validación que Clientes.jsx (lib/validators/cliente), así
// que un alta hecha acá nunca puede romper los CHECK de la base.
//
// Uso: <ClienteSelector value={clienteId} onChange={(id, cliente) => ...} />
export default function ClienteSelector({ value, onChange, autoFocus }) {
  const { clientes, createCliente } = useData()
  const [inputValue, setInputValue] = useState(() => clientes.find((c) => c.id === value)?.nombre || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNuevo, setShowNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState(null)
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [mail, setMail] = useState('')
  const [saving, setSaving] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [error, setError] = useState('')

  const clientesFiltrados = useMemo(() => {
    const term = normalizeText(inputValue).trim()
    const lista = term ? clientes.filter((c) => normalizeText(c.nombre).includes(term)) : clientes
    return lista.slice(0, 8)
  }, [clientes, inputValue])

  const errors = validarClienteForm({ nombre, telefono, condicionIva: 'consumidor_final', cuit: '', mail })
  if (cuit && cuit.length === 11) {
    // CuitInput ya valida el dígito verificador visualmente — acá solo se
    // exige longitud para no duplicar esa lógica.
  } else if (cuit) {
    errors.cuit = 'CUIT inválido'
  }

  const resetNuevo = () => {
    setShowNuevo(false)
    setNombre('')
    setTelefono(null)
    setDni('')
    setCuit('')
    setMail('')
    setIntentado(false)
  }

  const handleGuardar = async () => {
    setIntentado(true)
    if (Object.keys(errors).length > 0) return
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
      setInputValue(nuevo.nombre)
      resetNuevo()
    } catch (err) {
      setError(err.message || 'No se pudo crear el cliente.')
    } finally {
      setSaving(false)
    }
  }

  if (showNuevo) {
    return (
      <div className="space-y-3 p-4 bg-white/5 border border-[#FDE047]/30 rounded-xl">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#FDE047] uppercase tracking-widest">Cliente Nuevo</p>
          <button type="button" onClick={resetNuevo} className="text-gray-500 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>
        <TextInput
          required
          placeholder="Nombre completo"
          value={nombre}
          onChange={(v) => setNombre(v.replace(/[´`]/g, "'").toUpperCase())}
          maxLength={120}
          error={intentado ? errors.nombre : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <PhoneInput label="Teléfono" required value={telefono} onChange={setTelefono} error={intentado ? errors.telefono : undefined} />
          <DniInput label="DNI (opcional)" value={dni} onChange={setDni} />
        </div>
        <CuitInput label="CUIT (opcional)" value={cuit} onChange={setCuit} error={intentado ? errors.cuit : undefined} />
        <TextInput
          label="Email" type="email" placeholder="cliente@email.com" value={mail}
          onChange={(v) => setMail(v.toLowerCase())}
          error={intentado ? errors.mail : undefined}
        />
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleGuardar}
          disabled={saving}
          className="w-full py-2.5 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <UserPlus size={14} /> {saving ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Buscar cliente por nombre..."
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          onChange('', null)
          setShowDropdown(true)
        }}
        onFocus={(e) => {
          setShowDropdown(true)
          e.target.select()
        }}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none uppercase font-bold"
      />
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          {/* bg-[#0a0d14] opaco a propósito, no glass-card: este panel flota
              encima de contenido (ej. Temporada/Monto total/Asignar unidad
              en AsignarUnidadModal) y glass-card es semi-transparente por
              diseño — tapaba mal lo que había detrás (bug reportado). */}
          <div className="absolute left-0 right-0 mt-2 bg-[#0a0d14] border border-white/10 rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto shadow-2xl">
            {clientesFiltrados.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500 uppercase tracking-widest">Sin resultados</p>
            ) : (
              clientesFiltrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id, c)
                    setInputValue(c.nombre)
                    setShowDropdown(false)
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all uppercase font-bold"
                >
                  {c.nombre}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false)
                setShowNuevo(true)
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#FDE047] hover:bg-white/10 transition-all font-bold border-t border-white/10 flex items-center gap-2"
            >
              <UserPlus size={14} /> Crear cliente nuevo
            </button>
          </div>
        </>
      )}
    </div>
  )
}

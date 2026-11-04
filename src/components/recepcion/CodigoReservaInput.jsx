import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { PREFIJO, LARGO, filtrarCuerpo, normalizar, esValido, cuerpo as cuerpoDe } from '../../lib/codigoReserva'

// Input estricto del código de reserva (lib/codigoReserva.js es la única
// fuente del formato). El prefijo "PRIUS-" es fijo y visible: no se escribe ni
// se puede borrar. Los 6 caracteres aceptan solo el alfabeto de los códigos
// (A–Z sin I ni O, y 2–9), en mayúsculas; todo lo demás se descarta al
// instante con un aviso sutil. Largo fijo: no se puede escribir de más.
//
// Pegar: acepta el código completo con o sin "PRIUS-", en minúsculas, con
// espacios o desde la URL del QR; si lo pegado no es un código válido no
// carga nada y avisa. Al completarse un código válido se busca solo.
//
// `valor`: cuerpo (6 caracteres) cargado desde afuera (ej. ?codigo= en la URL);
// cuando cambia, el campo lo refleja. `error`: mensaje del padre (ej. "No
// encontramos una reserva con ese código").
export default function CodigoReservaInput({ valor = '', error = '', onBuscar, onEditar, className = '' }) {
  const [cuerpo, setCuerpo] = useState(valor)
  const [aviso, setAviso] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { setCuerpo(valor); setAviso('') }, [valor])

  const completo = cuerpo.length === LARGO && esValido(PREFIJO + cuerpo)

  const cambiar = (e) => {
    const { cuerpo: nuevo, descartados } = filtrarCuerpo(e.target.value)
    setCuerpo(nuevo)
    setAviso(descartados ? 'Acá van letras (sin I ni O) y números del 2 al 9.' : '')
    onEditar?.()
    if (nuevo.length === LARGO) onBuscar?.(PREFIJO + nuevo)
  }

  const pegar = (e) => {
    e.preventDefault()
    const texto = e.clipboardData?.getData('text') ?? ''
    if (!esValido(texto)) {
      setAviso('Eso no es un código de reserva válido. No se cargó nada.')
      return
    }
    const nuevo = cuerpoDe(texto)
    setCuerpo(nuevo)
    setAviso('')
    onEditar?.()
    onBuscar?.(normalizar(texto))
  }

  const enviar = () => {
    if (!completo) { setAviso('Código incompleto'); return }
    setAviso('')
    onBuscar?.(PREFIJO + cuerpo)
  }

  const mensaje = aviso || error
  const esError = !!error || aviso === 'Código incompleto' || aviso.startsWith('Eso no es')

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label
          className="flex-1 min-w-0 flex items-center h-12 px-4 rounded-full bg-surface cursor-text focus-within:ring-2 focus-within:ring-gold"
          onClick={() => inputRef.current?.focus()}
        >
          <span aria-hidden className="select-none text-body text-ink-2 font-mono tracking-wider">{PREFIJO}</span>
          <input
            ref={inputRef}
            type="text"
            value={cuerpo}
            onChange={cambiar}
            onPaste={pegar}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar() } }}
            maxLength={LARGO}
            placeholder="XXXXXX"
            aria-label="Código de reserva: 6 caracteres después de PRIUS-"
            aria-invalid={esError}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="flex-1 min-w-0 h-full bg-transparent outline-none font-mono text-body tracking-wider text-ink placeholder:text-ink-2/60"
          />
        </label>
        <button
          type="button"
          onClick={enviar}
          disabled={!completo}
          aria-label="Buscar reserva"
          className="w-12 h-12 shrink-0 rounded-full bg-ink text-on-ink flex items-center justify-center transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Search size={18} strokeWidth={1.5} />
        </button>
      </div>
      {mensaje && <p role={esError ? 'alert' : 'status'} className={`mt-2 text-label ${esError ? 'text-danger-ink' : 'text-ink-2'}`}>{mensaje}</p>}
    </div>
  )
}

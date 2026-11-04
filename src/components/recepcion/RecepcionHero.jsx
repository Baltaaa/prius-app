import { useEffect, useRef, useState } from 'react'
import { QrCode, ScanLine } from 'lucide-react'
import { Olas } from '../brand/patterns'
import SegmentedControl from '../brand/SegmentedControl'

const MODOS = [
  { value: 'camara', label: 'Cámara' },
  { value: 'lector', label: 'Lector' },
]

// Hero "Escanear QR": degradé dorado de marca con el patrón de olas. Cámara abre
// el escáner a pantalla completa (EscanearQR). Lector es para un lector USB
// tipo teclado: un input enfocado que captura el código + Enter y lo manda a la
// misma búsqueda que el código manual. En mobile no hay lector USB: la cámara es
// la acción principal y el selector de modo no se muestra.
export default function RecepcionHero({ modo, onModo, onAbrirCamara, onCodigoLeido, error = '' }) {
  const [texto, setTexto] = useState('')
  const [enfocado, setEnfocado] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (modo === 'lector') inputRef.current?.focus() }, [modo])

  const enviar = () => {
    const leido = texto
    setTexto('')
    if (leido.trim()) onCodigoLeido?.(leido)
    inputRef.current?.focus() // el lector sigue listo para el próximo código
  }

  return (
    <section className="relative overflow-hidden rounded-card bg-hero card-pad-hero text-ink">
      <Olas opacity={0.05} />
      <div className="relative flex flex-col gap-4 md:gap-6">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-card-title">Escanear QR</h2>
          <SegmentedControl className="hidden md:inline-flex" label="Modo de lectura" options={MODOS} value={modo} onChange={onModo} />
        </header>

        {modo === 'camara' ? (
          <div className="flex flex-col gap-3">
            <p className="text-body">Apuntá la cámara al QR de la reserva del cliente.</p>
            <button
              type="button"
              onClick={onAbrirCamara}
              className="btn btn-secondary h-14 md:h-12 w-full md:w-fit md:px-6 gap-3 text-body"
            >
              <QrCode size={22} strokeWidth={1.5} /> Abrir cámara
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body">Escaneá el código con el lector: se carga solo al terminar de leerlo.</p>
            <label className="flex items-center gap-3 h-12 px-4 rounded-full bg-card focus-within:ring-2 focus-within:ring-ink">
              <ScanLine size={20} strokeWidth={1.5} className="shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar() } }}
                onFocus={() => setEnfocado(true)}
                onBlur={() => setEnfocado(false)}
                placeholder={enfocado ? 'Esperando lectura…' : 'Tocá acá para activar el lector'}
                aria-label="Lector de código de reserva"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="flex-1 min-w-0 h-full bg-transparent outline-none font-mono text-body text-ink placeholder:text-ink-2"
              />
            </label>
            {error && <p role="alert" className="text-label">{error}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

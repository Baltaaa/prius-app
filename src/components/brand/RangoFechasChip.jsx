import { useId, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import BottomSheet from './BottomSheet'
import PopoverAnclado from '../ui/PopoverAnclado'
import DateInput from '../inputs/DateInput'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import 'react-day-picker/style.css'
import { useOverlay } from '../../context/OverlayProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { formatFechaCorta, formatFecha } from '../../lib/format'

// Rango de fechas como UN solo chip ("28/10 – 04/11") que abre un popover con
// los dos selectores (desde 768px) o un bottom sheet (mobile). Reemplaza a los
// dos DateInput sueltos de las toolbars: ocupa una celda de 40px en la fila.
//
const aDate = (iso) => { if (!iso) return undefined; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Contenido del bottom sheet (mobile): los dos pickers inline, centrados y a ancho
// completo, nunca un popover anclado como el de desktop. Dos campos (Desde / Hasta)
// que alternan el calendario de abajo; al elegir "Desde" pasa solo a "Hasta".
function SelectorRangoSheet({ desde, hasta, setDesde, setHasta }) {
  const [activo, setActivo] = useState(desde && !hasta ? 'hasta' : 'desde')
  const valor = activo === 'desde' ? desde : hasta
  const elegir = (d) => {
    if (!d) return
    const iso = aIso(d)
    if (activo === 'desde') {
      setDesde(iso)
      if (hasta && hasta < iso) setHasta('')
      setActivo('hasta')
    } else {
      setHasta(iso)
    }
  }
  const campo = (clave, etiqueta, v) => (
    <button
      key={clave}
      type="button"
      onClick={() => setActivo(clave)}
      aria-pressed={activo === clave}
      className={`min-h-11 rounded-inner border px-3 py-2 text-left anim-colors ${activo === clave ? 'border-gold bg-gold-50' : 'border-line bg-card'}`}
    >
      <span className="block text-label text-ink-2">{etiqueta}</span>
      <span className="block text-body font-semibold text-ink tabular-nums">{v ? formatFecha(v) : 'Elegí una fecha'}</span>
    </button>
  )
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {campo('desde', 'Desde', desde)}
        {campo('hasta', 'Hasta', hasta)}
      </div>
      <div className="mt-3 flex justify-center dp-prius dp-full" data-rango-picker={activo}>
        <DayPicker
          key={activo}
          mode="single"
          locale={es}
          weekStartsOn={1}
          selected={aDate(valor)}
          defaultMonth={aDate(valor) || aDate(activo === 'hasta' ? desde : null) || new Date()}
          disabled={activo === 'hasta' && desde ? [{ before: aDate(desde) }] : undefined}
          onSelect={elegir}
        />
      </div>
    </div>
  )
}

// - `conAnio`: "04/11/25 – 04/11/26" en lugar de "04/11 – 04/11".
// - `vacio`: texto cuando no hay ninguna fecha (rangos opcionales, ej. Reservas).
// - `onLimpiar`: si se pasa, el popover/sheet trae "Limpiar" mientras haya fechas.
export default function RangoFechasChip({
  desde, hasta, setDesde, setHasta, conAnio = false, vacio = 'Fechas', etiqueta = 'Rango de fechas', onLimpiar, className = '',
}) {
  const [abierto, setAbierto] = useState(false)
  const esMobile = !useMediaQuery('(min-width: 768px)')
  const id = useId()
  const anclaRef = useRef(null)
  const { bind } = useOverlay({ id: `rango-${id}`, isOpen: abierto && !esMobile, onRequestClose: () => setAbierto(false) })
  const hay = !!(desde || hasta)
  const texto = hay
    ? `${desde ? formatFechaCorta(desde, conAnio) : '—'} – ${hasta ? formatFechaCorta(hasta, conAnio) : '—'}`
    : vacio
  const selectoresDesktop = (
    <div className="space-y-3">
      <DateInput label="Desde" value={desde || null} onChange={(v) => setDesde(v || '')} placeholder="Desde" />
      <DateInput label="Hasta" value={hasta || null} onChange={(v) => setHasta(v || '')} placeholder="Hasta" min={desde || undefined} />
      {onLimpiar && hay && (
        <button type="button" onClick={() => { onLimpiar(); setAbierto(false) }} className="btn btn-secondary w-full">Limpiar</button>
      )}
    </div>
  )
  return (
    <div ref={anclaRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={esMobile ? undefined : bind}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title={etiqueta}
        aria-label={`${etiqueta}: ${texto}`}
        className="btn btn-secondary w-full h-11 md:h-10 min-h-0 px-3 justify-start gap-2 tabular-nums"
      >
        <CalendarDays size={16} strokeWidth={1.5} className="shrink-0 max-[400px]:hidden" />
        <span className="truncate">{texto}</span>
      </button>

      {esMobile ? (
        <BottomSheet isOpen={abierto} onClose={() => setAbierto(false)} title={etiqueta}>
          <SelectorRangoSheet desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
          {onLimpiar && hay && (
            <button type="button" onClick={() => { onLimpiar(); setAbierto(false) }} className="btn btn-secondary w-full mt-3">Limpiar</button>
          )}
          <button type="button" onClick={() => setAbierto(false)} className="btn btn-primary w-full mt-3">Listo</button>
        </BottomSheet>
      ) : (
        abierto && (
          <PopoverAnclado ref={bind} anchorRef={anclaRef} width={288} role="dialog" aria-label={etiqueta} className="p-4" scroll={false}>
            {selectoresDesktop}
          </PopoverAnclado>
        )
      )}
    </div>
  )
}

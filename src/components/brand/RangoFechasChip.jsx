import { useId, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import BottomSheet from './BottomSheet'
import DateInput from '../inputs/DateInput'
import { useOverlay } from '../../context/OverlayProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { formatFechaCorta } from '../../lib/format'

// Rango de fechas como UN solo chip ("28/10 – 04/11") que abre un popover con
// los dos selectores (desde 768px) o un bottom sheet (mobile). Reemplaza a los
// dos DateInput sueltos de las toolbars: ocupa una celda de 40px en la fila.
//
// - `conAnio`: "04/11/25 – 04/11/26" en lugar de "04/11 – 04/11".
// - `vacio`: texto cuando no hay ninguna fecha (rangos opcionales, ej. Reservas).
// - `onLimpiar`: si se pasa, el popover/sheet trae "Limpiar" mientras haya fechas.
export default function RangoFechasChip({
  desde, hasta, setDesde, setHasta, conAnio = false, vacio = 'Fechas', etiqueta = 'Rango de fechas', onLimpiar, className = '',
}) {
  const [abierto, setAbierto] = useState(false)
  const esMobile = !useMediaQuery('(min-width: 768px)')
  const id = useId()
  const { bind } = useOverlay({ id: `rango-${id}`, isOpen: abierto && !esMobile, onRequestClose: () => setAbierto(false) })
  const hay = !!(desde || hasta)
  const texto = hay
    ? `${desde ? formatFechaCorta(desde, conAnio) : '—'} – ${hasta ? formatFechaCorta(hasta, conAnio) : '—'}`
    : vacio
  const selectores = (
    <div className="space-y-3">
      <DateInput label="Desde" value={desde || null} onChange={(v) => setDesde(v || '')} placeholder="Desde" />
      <DateInput label="Hasta" value={hasta || null} onChange={(v) => setHasta(v || '')} placeholder="Hasta" min={desde || undefined} />
      {onLimpiar && hay && (
        <button type="button" onClick={() => { onLimpiar(); setAbierto(false) }} className="btn btn-secondary w-full">Limpiar</button>
      )}
    </div>
  )
  return (
    <div className={`relative min-w-0 ${className}`}>
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
          {selectores}
          <button type="button" onClick={() => setAbierto(false)} className="btn btn-primary w-full mt-4">Listo</button>
        </BottomSheet>
      ) : (
        abierto && (
          <div ref={bind} role="dialog" aria-label={etiqueta} className="absolute left-0 top-full mt-2 z-50 w-72 surface-pop ui-open p-4">
            {selectores}
          </div>
        )
      )}
    </div>
  )
}

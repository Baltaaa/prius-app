import { useRef, useState } from 'react'
import { Download, Printer, Share2 } from 'lucide-react'
import SegmentedControl from '../brand/SegmentedControl'
import RangoFechasChip from '../brand/RangoFechasChip'
import WhatsAppIcon from '../ui/WhatsAppIcon'
import PopoverAnclado from '../ui/PopoverAnclado'
import { useOverlay } from '../../context/OverlayProvider'
import { PERIODOS } from '../../lib/reportes'

// Controles de Reportes para la zona sticky superior (ToolbarSticky). Todo en
// poco alto para que el primer pantallazo sea de datos:
//   - Diario / Semanal / Mensual / Anual a ancho completo (hasta lg).
//   - El rango de fechas es UN chip ("04/11/25 – 04/11/26", RangoFechasChip) que abre
//     un bottom sheet con los dos selectores (mobile) o un popover (desktop).
//   - Pesos / Dólares como toggle chico.
//   - WhatsApp, Descargar e Imprimir: un botón "Compartir" con menú en mobile
//     y tablet; tres íconos sueltos desde lg.

const MONEDAS = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
]

function Compartir({ onWhatsApp, linkWa, onCsv, onImprimir }) {
  const [abierto, setAbierto] = useState(false)
  const { bind } = useOverlay({ id: 'reportes-compartir', isOpen: abierto, onRequestClose: () => setAbierto(false) })
  const anclaRef = useRef(null)
  const item = 'w-full text-left px-4 min-h-11 text-label text-ink hover:bg-surface flex items-center gap-3 rounded-icon disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div ref={anclaRef} className="relative shrink-0">
      <button
        ref={bind}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label="Compartir"
        title="Compartir"
        className="btn btn-secondary h-11 w-11 md:h-10 md:w-auto min-h-0 px-0 md:px-4"
      >
        <Share2 size={16} strokeWidth={1.5} />
        <span className="hidden md:inline">Compartir</span>
      </button>
      {abierto && (
        <PopoverAnclado ref={bind} anchorRef={anclaRef} align="right" width={240} role="menu" className="p-1">
          <button role="menuitem" type="button" disabled={!linkWa} title={linkWa ? 'Enviar a mi WhatsApp' : 'Cargá tu teléfono en Mi cuenta'}
            onClick={() => { setAbierto(false); onWhatsApp() }} className={item}>
            <WhatsAppIcon size={16} /> WhatsApp
          </button>
          <button role="menuitem" type="button" onClick={() => { setAbierto(false); onCsv() }} className={item}>
            <Download size={16} /> Descargar CSV
          </button>
          <button role="menuitem" type="button" onClick={() => { setAbierto(false); onImprimir() }} className={item}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </PopoverAnclado>
      )}
    </div>
  )
}

function AccionesDesktop({ onWhatsApp, linkWa, onCsv, onImprimir }) {
  const btn = 'btn btn-secondary h-10 w-10 min-h-0 px-0 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div className="hidden lg:flex items-center gap-2 ml-auto">
      <button type="button" onClick={onWhatsApp} disabled={!linkWa} title={linkWa ? 'Enviar a mi WhatsApp' : 'Cargá tu teléfono en Mi cuenta'} aria-label="WhatsApp" className={btn}>
        <WhatsAppIcon size={16} />
      </button>
      <button type="button" onClick={onCsv} title="Descargar CSV" aria-label="Descargar CSV" className={btn}>
        <Download size={16} strokeWidth={1.5} />
      </button>
      <button type="button" onClick={onImprimir} title="Imprimir / PDF" aria-label="Imprimir / PDF" className={btn}>
        <Printer size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default function ReportesControles({
  periodo, setPeriodo, moneda, setMoneda, desde, hasta, setDesde, setHasta,
  onWhatsApp, linkWa, onCsv, onImprimir,
}) {
  return (
    <div className="toolbar-40 no-print flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Agrupar por"
        options={PERIODOS}
        value={periodo}
        onChange={setPeriodo}
        fullWidth="hasta-lg"
      />
      <div className="flex items-center gap-2 w-full lg:w-auto lg:contents">
        <RangoFechasChip desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} conAnio className="flex-1 lg:flex-none lg:w-52" />
        <SegmentedControl label="Moneda" options={MONEDAS} value={moneda} onChange={setMoneda} compact className="shrink-0" />
        <div className="lg:hidden shrink-0">
          <Compartir onWhatsApp={onWhatsApp} linkWa={linkWa} onCsv={onCsv} onImprimir={onImprimir} />
        </div>
      </div>
      <AccionesDesktop onWhatsApp={onWhatsApp} linkWa={linkWa} onCsv={onCsv} onImprimir={onImprimir} />
    </div>
  )
}

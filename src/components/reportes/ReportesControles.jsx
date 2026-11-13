import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Printer, FileDown, Share2, Image as ImageIcon } from 'lucide-react'
import SegmentedScroll from '../brand/SegmentedScroll'
import SegmentedControl from '../brand/SegmentedControl'
import RangoFechasChip from '../brand/RangoFechasChip'
import WhatsAppIcon from '../ui/WhatsAppIcon'
import PopoverAnclado from '../ui/PopoverAnclado'
import BottomSheet from '../brand/BottomSheet'
import { useOverlay } from '../../context/OverlayProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { VISTAS, navegable } from '../../lib/periodos'

// Barra sticky de Reportes (nov 2026, rediseño mobile-first).
//
// Fila 1: Día / Semana / Mes / Temporada / Año / Rango en UNA línea con scroll
//         y snap (SegmentedScroll — nunca en dos líneas).
// Fila 2: navegador ‹ período ›, el chip de rango cuando la vista es 'rango',
//         el toggle ARS/USD y Exportar.
//
// Máximo dos filas y controles de 40px, como el resto de las toolbars de
// desktop (ver CLAUDE.md).

const MONEDAS = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
]

const ITEM = 'w-full text-left px-4 min-h-11 text-label text-ink hover:bg-surface flex items-center gap-3 rounded-icon disabled:opacity-40 disabled:cursor-not-allowed'

function MenuExportar({ acciones, onCerrar }) {
  return (
    <div className="p-1">
      <button type="button" onClick={() => { onCerrar(); acciones.onPdf() }} className={ITEM}>
        <FileDown size={16} /> Descargar PDF
      </button>
      <button type="button" onClick={() => { onCerrar(); acciones.onImprimir() }} className={ITEM}>
        <Printer size={16} /> Imprimir A4
      </button>
      <button type="button" onClick={() => { onCerrar(); acciones.onCsv() }} className={ITEM}>
        <Download size={16} /> Descargar CSV
      </button>
      <button type="button" onClick={() => { onCerrar(); acciones.onImagen() }} className={ITEM}>
        <ImageIcon size={16} /> Compartir imagen
      </button>
      <button
        type="button"
        disabled={!acciones.linkWa}
        title={acciones.linkWa ? 'Enviar el resumen a mi WhatsApp' : 'Cargá tu teléfono en Mi cuenta'}
        onClick={() => { onCerrar(); acciones.onWhatsApp() }}
        className={ITEM}
      >
        <WhatsAppIcon size={16} /> Resumen por WhatsApp
      </button>
    </div>
  )
}

function Exportar({ acciones }) {
  const [abierto, setAbierto] = useState(false)
  const { bind } = useOverlay({ id: 'reportes-exportar', isOpen: abierto, onRequestClose: () => setAbierto(false) })
  const anclaRef = useRef(null)
  const esMobile = useMediaQuery('(max-width: 767px)')
  const cerrar = () => setAbierto(false)

  return (
    <div ref={anclaRef} className="relative shrink-0">
      <button
        ref={bind}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label="Exportar"
        title="Exportar"
        className="btn btn-secondary h-11 w-11 md:h-10 md:w-auto min-h-0 px-0 md:px-4"
      >
        <Share2 size={16} strokeWidth={1.5} />
        <span className="hidden md:inline">Exportar</span>
      </button>
      {abierto && (esMobile ? (
        <BottomSheet isOpen={abierto} onClose={cerrar} title="Exportar">
          <MenuExportar acciones={acciones} onCerrar={cerrar} />
        </BottomSheet>
      ) : (
        <PopoverAnclado ref={bind} anchorRef={anclaRef} align="right" width={260} role="menu" className="p-0">
          <MenuExportar acciones={acciones} onCerrar={cerrar} />
        </PopoverAnclado>
      ))}
    </div>
  )
}

export default function ReportesControles({
  vista, setVista, etiqueta, onAnterior, onSiguiente,
  moneda, setMoneda, rango, setRango, acciones,
}) {
  const puedeNavegar = navegable(vista)
  return (
    <div className="no-print space-y-2">
      <SegmentedScroll options={VISTAS} value={vista} onChange={setVista} label="Período" />

      <div className="toolbar-40 flex items-center gap-2">
        {puedeNavegar ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onAnterior}
              aria-label="Período anterior"
              title="Período anterior"
              className="btn btn-secondary h-11 w-11 md:h-10 md:w-10 min-h-0 px-0"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="text-body text-ink font-medium whitespace-nowrap px-2 min-w-0 truncate" title={etiqueta}>
              {etiqueta}
            </span>
            <button
              type="button"
              onClick={onSiguiente}
              aria-label="Período siguiente"
              title="Período siguiente"
              className="btn btn-secondary h-11 w-11 md:h-10 md:w-10 min-h-0 px-0"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        ) : vista === 'rango' ? (
          <RangoFechasChip
            desde={rango.desde}
            hasta={rango.hasta}
            setDesde={(d) => setRango((r) => ({ ...r, desde: d }))}
            setHasta={(h) => setRango((r) => ({ ...r, hasta: h }))}
            conAnio
            className="flex-1 min-w-0 lg:flex-none lg:w-52"
          />
        ) : (
          <span className="text-body text-ink font-medium whitespace-nowrap min-w-0 truncate" title={etiqueta}>
            {etiqueta}
          </span>
        )}

        <div className="flex-1" />
        <SegmentedControl label="Moneda" options={MONEDAS} value={moneda} onChange={setMoneda} compact className="shrink-0" />
        <Exportar acciones={acciones} />
      </div>
    </div>
  )
}

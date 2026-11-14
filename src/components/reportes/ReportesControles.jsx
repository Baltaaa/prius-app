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

// Controles de Reportes dentro de la barra única (PageTopbar, nov 2026).
//
// UNA sola fila: Día/Semana/Mes/Temporada/Año/Rango · navegador ‹ período › (o
// el chip de rango) · ARS/USD · Exportar. Nunca dos filas: si no entran,
// ToolbarSticky scrollea la fila en horizontal con fade en los bordes.
// Controles de 40px (pills), igual que el resto de la zona sticky.

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
      {/* Solo ícono con tooltip hasta lg: en una sola fila el texto no entra. */}
      <button
        ref={bind}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label="Exportar"
        title="Exportar"
        className="pill-control pill-control-icono lg:w-auto lg:px-4"
      >
        <Share2 size={16} strokeWidth={1.5} />
        <span className="hidden lg:inline">Exportar</span>
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
    <>
      <SegmentedScroll options={VISTAS} value={vista} onChange={setVista} label="Período" className="min-w-0 max-w-[min(60vw,420px)]" />

      {puedeNavegar ? (
        // El navegador de fecha es UNA pill: ‹ Noviembre 2026 ›.
        <div className="pill-control !px-1 gap-0">
          <button
            type="button"
            onClick={onAnterior}
            aria-label="Período anterior"
            title="Período anterior"
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-ink hover:bg-card/60 transition-colors"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <span className="px-2 whitespace-nowrap" title={etiqueta}>{etiqueta}</span>
          <button
            type="button"
            onClick={onSiguiente}
            aria-label="Período siguiente"
            title="Período siguiente"
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-ink hover:bg-card/60 transition-colors"
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
          className="w-52"
        />
      ) : (
        <span className="pill-control" title={etiqueta}>{etiqueta}</span>
      )}

      <SegmentedControl label="Moneda" options={MONEDAS} value={moneda} onChange={setMoneda} compact />
      <Exportar acciones={acciones} />
    </>
  )
}

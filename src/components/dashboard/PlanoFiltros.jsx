import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Info, Printer, PrinterCheck } from 'lucide-react'
import DateInput from '../inputs/DateInput'
import SegmentedControl from '../brand/SegmentedControl'
import PlanoLeyenda from './PlanoLeyenda'
import PopoverAnclado from '../ui/PopoverAnclado'
import { useOverlay } from '../../context/OverlayProvider'
import { formatMonto, formatMontoCompacto, formatFecha, formatDiaCorto } from '../../lib/format'
import { unidadEmoji } from '../../lib/unidadIcono'

export const pct = (n) => `${Math.round((n || 0) * 100)}%`

// Las stats del Plano SON los filtros (ya no hay una fila de chips duplicada):
// cuatro tiles que funcionan como un segmented de estado. Activo = gold-50 con
// aro e indicador dorado, igual que la fila seleccionada de las listas.
// `valor`: null (Todas) | 'ocupacion' | 'libres' | 'pendientes'.
//
// Alcance de "Pendientes del día": unidades ocupadas en la fecha elegida con
// saldo por cobrar (misma cuenta que la ficha, lib/saldos.js). El Home suma
// la temporada completa, por eso dice "de la temporada" y este "del día".
export function PlanoStatTiles({ stats, valor, onChange, fecha, compacto = false, className = '' }) {
  if (!stats) return null
  const total = stats.ocupacion.total
  const fmt = compacto ? formatMontoCompacto : formatMonto
  const saldo = stats.pendientes.saldo > 0 ? fmt(stats.pendientes.saldo) : null
  // `texto` es el resumen accesible; `principal` el número grande y `pill` el valor secundario
  // (porcentaje o monto), en una etiqueta negra como el "↑ 79,5%" del Dashboard.
  const pctLibres = pct(stats.libres.count / Math.max(1, total))
  const tiles = [
    { key: null, label: 'Todas', principal: String(total), texto: String(total) },
    { key: 'ocupacion', label: 'Ocupadas', principal: String(stats.ocupacion.count), pill: pct(stats.ocupacion.pct), texto: `${stats.ocupacion.count} · ${pct(stats.ocupacion.pct)}` },
    { key: 'libres', label: 'Libres', principal: String(stats.libres.count), pill: pctLibres, texto: `${stats.libres.count} · ${pctLibres}` },
    {
      key: 'pendientes',
      label: compacto ? 'Pendientes' : 'Pendientes del día',
      principal: String(stats.pendientes.count),
      pill: saldo,
      texto: `${stats.pendientes.count}${saldo ? ` · ${saldo}` : ''}`,
      ayuda: `Unidades ocupadas el ${formatFecha(fecha)} con saldo por cobrar. No incluye reservas fuera de esa fecha: el Dashboard suma toda la temporada.`,
    },
  ]
  return (
    <div role="radiogroup" aria-label="Filtrar el plano por estado" className={`${compacto ? 'flex gap-1' : 'grid grid-cols-2 lg:grid-cols-4 gap-2'} ${className}`}>
      {tiles.map((t) => {
        const activo = (valor ?? null) === t.key
        return (
          <button
            key={String(t.key)}
            type="button"
            role="radio"
            aria-checked={activo}
            title={t.ayuda ? `${t.label}: ${t.texto}. ${t.ayuda}` : `${t.label}: ${t.texto}`}
            onClick={() => onChange(t.key)}
            className={`relative min-h-12 min-w-0 ${compacto ? 'flex-auto px-2' : 'px-3'} py-1 flex flex-col justify-center rounded-inner text-left transition-colors ${
              activo ? 'bg-gold-50 ring-1 ring-gold' : 'bg-surface hover:bg-line/50'
            }`}
          >
            {activo && <span aria-hidden className="absolute left-0 inset-y-2 w-1 rounded-full bg-gold" />}
            <span className="block text-label text-ink-2 truncate">{t.label}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <span className={`${compacto ? 'text-label font-semibold' : 'text-body'} text-ink tabular-nums whitespace-nowrap`}>{t.principal}</span>
              {t.pill && <span data-tile-pill className="inline-flex items-center rounded-full bg-ink text-on-ink text-label tabular-nums whitespace-nowrap px-2 py-0.5">{t.pill}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Tipo de unidad: Todo / Carpas / Sombrillas (con el emoji de cada una).
// `valor`: null (Todo) | 'carpas' | 'sombrillas'.
export function PlanoTipoSegmented({ valor, onChange, fullWidth = false, className = '' }) {
  const opciones = [
    { value: 'todo', label: 'Todo' },
    { value: 'carpas', label: `${unidadEmoji('carpa')} Carpas` },
    { value: 'sombrillas', label: `${unidadEmoji('sombrilla')} Sombrillas` },
  ]
  return (
    <SegmentedControl
      label="Filtrar el plano por tipo de unidad"
      options={opciones}
      value={valor ?? 'todo'}
      onChange={(v) => onChange(v === 'todo' ? null : v)}
      fullWidth={fullWidth}
      className={className}
    />
  )
}

// "Referencias": la leyenda vive en un popover que se cierra con click afuera
// (y con Escape) por el mismo gestor de overlays que el resto de la app.
export function PlanoReferencias({ soloIcono = false, className = '' }) {
  const [abierto, setAbierto] = useState(false)
  const anclaRef = useRef(null)
  const { bind } = useOverlay({ id: 'plano-referencias', isOpen: abierto, onRequestClose: () => setAbierto(false) })
  return (
    <div ref={anclaRef} className={`relative ${className}`}>
      <button
        ref={bind}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title="Referencias"
        className={`pill-control ${soloIcono ? 'pill-control-icono' : ''}`}
      >
        <Info size={16} strokeWidth={1.5} />
        {!soloIcono && <span>Referencias</span>}
        {soloIcono && <span className="sr-only">Referencias</span>}
      </button>
      {abierto && (
        <PopoverAnclado ref={bind} anchorRef={anclaRef} align="right" width={320} role="dialog" aria-label="Referencias del plano" className="p-4">
          <p className="section-label !mt-0">Referencias</p>
          <PlanoLeyenda />
        </PopoverAnclado>
      )}
    </div>
  )
}

export { PlanoLeyenda }

// Referencias + las dos impresiones del Plano, como pills de 40px en la fila
// de controles de la barra única:
// - "Imprimir A4": la hoja de los carperos, sin cambios (PlanoImpresion.jsx).
// - "Imprimir para el cliente": la hoja de disponibilidad Libre/Ocupado
//   (PlanoImpresionCliente.jsx) — otra impresión, no toca la anterior.
export function PlanoAcciones({ onImprimir, onImprimirCliente, className = '' }) {
  return (
    <>
      <PlanoReferencias soloIcono className={className} />
      <button onClick={onImprimir} title="Imprimir A4 (carperos)" aria-label="Imprimir A4 (carperos)" className="pill-control pill-control-icono">
        <Printer size={16} strokeWidth={1.5} />
      </button>
      {onImprimirCliente && (
        <button onClick={onImprimirCliente} title="Imprimir plano de disponibilidad (cliente)" aria-label="Imprimir plano de disponibilidad (cliente)" className="pill-control pill-control-icono xl:w-auto xl:px-4">
          <PrinterCheck size={16} strokeWidth={1.5} />
          <span className="hidden xl:inline">Imprimir</span>
        </button>
      )}
    </>
  )
}

// Navegador de fecha del Plano como UNA pill de 40px: ‹ fecha ›. Vive en la
// fila de controles de la barra única (PageTopbar) y, en pantalla completa,
// en la franja del modo cliente.
export function PlanoNavegadorFecha({
  selectedDate, esHoy, diaSemana, onPrevDay, onNextDay, onHoy, onDateChange, compacto = false, className = '',
}) {
  return (
    <div className={`pill-control !px-1 gap-0 ${className}`}>
      <button onClick={onPrevDay} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-ink hover:bg-card/60 transition-colors" aria-label="Día anterior" title="Día anterior">
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>
      <div className="min-w-0 flex items-center justify-center gap-1 px-1">
        {/* Mobile (compacto): fecha corta que siempre entra ("Jue 06/11"),
            con un chip "Hoy" cuando corresponde. Nunca truncada. */}
        <DateInput
          value={selectedDate}
          onChange={(v) => v && onDateChange(v)}
          calendarOnly
          className={`${compacto ? 'w-[112px]' : 'w-[132px]'} [&_.field]:!bg-transparent [&_.field]:!border-transparent`}
          formatoVisible={compacto ? formatDiaCorto : undefined}
        />
        {diaSemana && <span className="hidden xl:inline text-label text-ink-2 shrink-0">{diaSemana}</span>}
        {compacto && esHoy && (
          <span className="shrink-0 inline-flex items-center h-7 px-3 rounded-full bg-gold-100 text-label text-ink">Hoy</span>
        )}
        {!esHoy && (
          <button onClick={onHoy} className="text-label text-ink shrink-0 h-8 px-2 rounded-full hover:bg-card/60 transition-colors">Hoy</button>
        )}
      </div>
      <button onClick={onNextDay} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-ink hover:bg-card/60 transition-colors" aria-label="Día siguiente" title="Día siguiente">
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}

// Controles del Plano que viven en la barra única (desktop, tablet y mobile
// comparten este bloque): navegador de fecha, segmented de tipo, Referencias,
// Imprimir A4 y la impresión para el cliente. Los tiles-filtro de estado NO
// van acá: son stats de 4 celdas y siguen en la card de la página
// (PlanoStatTiles), que es donde se leen como números.
//
// La vista clientes (pantalla completa) no usa este bloque: monta
// PlanoNavegadorFecha dentro de MarcoPlanoClaro (components/plano), que trae
// sus propios chips Todo/Carpas/Sombrillas.
export function PlanoControles({
  selectedDate, esHoy, diaSemana, onPrevDay, onNextDay, onHoy, onDateChange,
  tipoFiltro, onTipo, onImprimir, onImprimirCliente, compacto = false,
}) {
  return (
    <>
      <PlanoNavegadorFecha
        selectedDate={selectedDate}
        esHoy={esHoy}
        diaSemana={diaSemana}
        onPrevDay={onPrevDay}
        onNextDay={onNextDay}
        onHoy={onHoy}
        onDateChange={onDateChange}
        compacto={compacto}
      />

      <PlanoTipoSegmented valor={tipoFiltro} onChange={onTipo} />

      <PlanoAcciones onImprimir={onImprimir} onImprimirCliente={onImprimirCliente} />
    </>
  )
}

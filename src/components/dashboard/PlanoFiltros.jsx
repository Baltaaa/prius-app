import { useState } from 'react'
import { ChevronLeft, ChevronRight, Info, Printer } from 'lucide-react'
import DateInput from '../inputs/DateInput'
import SegmentedControl from '../brand/SegmentedControl'
import PlanoLeyenda from './PlanoLeyenda'
import { useOverlay } from '../../context/OverlayProvider'
import { formatPesos, formatPesosCompacto, formatFecha, formatDiaCorto } from '../../lib/format'
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
  const fmt = compacto ? formatPesosCompacto : formatPesos
  const saldo = stats.pendientes.saldo > 0 ? ` · ${fmt(stats.pendientes.saldo)}` : ''
  const tiles = [
    { key: null, label: 'Todas', texto: String(total) },
    { key: 'ocupacion', label: 'Ocupadas', texto: `${stats.ocupacion.count} · ${pct(stats.ocupacion.pct)}` },
    { key: 'libres', label: 'Libres', texto: `${stats.libres.count} · ${pct(stats.libres.count / Math.max(1, total))}` },
    {
      key: 'pendientes',
      label: compacto ? 'Pendientes' : 'Pendientes del día',
      texto: `${stats.pendientes.count}${saldo}`,
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
            <span className={`block ${compacto ? 'text-label font-semibold' : 'text-body'} text-ink tabular-nums whitespace-nowrap truncate`}>{t.texto}</span>
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
  const { bind } = useOverlay({ id: 'plano-referencias', isOpen: abierto, onRequestClose: () => setAbierto(false) })
  return (
    <div className={`relative ${className}`}>
      <button
        ref={bind}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title="Referencias"
        className={`btn btn-secondary h-11 md:h-9 min-h-0 shrink-0 ${soloIcono ? 'w-11 md:w-9 px-0' : 'px-4'}`}
      >
        <Info size={16} strokeWidth={1.5} />
        {!soloIcono && <span>Referencias</span>}
        {soloIcono && <span className="sr-only">Referencias</span>}
      </button>
      {abierto && (
        <div ref={bind} role="dialog" aria-label="Referencias del plano" className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] surface-pop ui-open p-4">
          <p className="section-label !mt-0">Referencias</p>
          <PlanoLeyenda />
        </div>
      )}
    </div>
  )
}

export { PlanoLeyenda }

// Referencias + Imprimir A4 (secundario). Desde lg viven en la franja de
// controles; por debajo van en el encabezado de la card del mapa, para que el
// navegador de fecha tenga el ancho completo.
export function PlanoAcciones({ onImprimir, className = '' }) {
  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
      <PlanoReferencias soloIcono />
      <button onClick={onImprimir} title="Imprimir A4" aria-label="Imprimir A4" className="btn btn-secondary h-11 md:h-9 min-h-0 w-11 md:w-9 px-0 2xl:w-auto 2xl:px-4 shrink-0">
        <Printer size={16} strokeWidth={1.5} /> <span className="hidden 2xl:inline">Imprimir A4</span>
      </button>
    </div>
  )
}

// Controles completos del Plano (desktop, tablet y mobile comparten este
// bloque): navegador de fecha, tiles-filtro de estado, segmented de tipo,
// Referencias e Imprimir A4. Desde lg (1024px) todo va en dos filas (fecha ·
// tipo · acciones / tiles); por debajo, en columna: fecha a ancho completo,
// tiles 2x2 y segmented a ancho completo, con targets de 44px.
export function PlanoControles({
  selectedDate, esHoy, diaSemana, onPrevDay, onNextDay, onHoy, onDateChange,
  planoStats, estadoFiltro, onEstado, tipoFiltro, onTipo, onImprimir, compacto = false, anchoFecha,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="order-1 flex items-center gap-1 bg-surface p-1 rounded-inner flex-1 min-w-0 lg:flex-none">
        <button onClick={onPrevDay} className="w-11 h-11 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full bg-card text-ink-2 hover:bg-line transition-colors" title="Día anterior">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-1">
          {/* Mobile (compacto): fecha corta que siempre entra ("Jue 06/11"),
              con un chip "Hoy" cuando corresponde. Nunca truncada. */}
          <DateInput
            value={selectedDate}
            onChange={(v) => v && onDateChange(v)}
            calendarOnly
            className={compacto ? 'flex-1 min-w-0' : anchoFecha}
            formatoVisible={compacto ? formatDiaCorto : undefined}
          />
          {diaSemana && <span className="hidden md:inline lg:hidden xl:inline text-label text-ink-2 shrink-0">{diaSemana}</span>}
          {compacto && esHoy && (
            <span className="shrink-0 inline-flex items-center h-7 px-3 rounded-full bg-gold-100 text-label text-ink">Hoy</span>
          )}
          {!esHoy && (
            <button onClick={onHoy} className="text-label text-ink shrink-0 min-h-11 md:min-h-0 min-w-11 md:min-w-0 px-2">Hoy</button>
          )}
        </div>
        <button onClick={onNextDay} className="w-11 h-11 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full bg-card text-ink-2 hover:bg-line transition-colors" title="Día siguiente">
          <ChevronRight size={16} />
        </button>
      </div>

      <PlanoAcciones onImprimir={onImprimir} className="hidden lg:flex order-3 ml-auto" />

      <PlanoStatTiles
        className="order-3 lg:order-4 basis-full"
        stats={planoStats}
        valor={estadoFiltro}
        onChange={onEstado}
        fecha={selectedDate}
        compacto={compacto}
      />

      <PlanoTipoSegmented
        className="order-4 basis-full lg:order-2 lg:basis-auto"
        fullWidth="hasta-lg"
        valor={tipoFiltro}
        onChange={onTipo}
      />
    </div>
  )
}

import { ChevronLeft, ChevronRight, Printer, Layers } from "lucide-react"
import PlanoGrid from "../plano/PlanoGrid"
import PlanoViewport from "../plano/PlanoViewport"
import DateInput from "../inputs/DateInput"
import PlanoZoomBar from "./PlanoZoomBar"
import PlanoLeyenda from "./PlanoLeyenda"
import { pct } from "./PlanoStatsBar"
import { formatPesosCompacto } from "../../lib/format"

// Plano mobile (<768px, mock 02-plano-mobile) — componente NUEVO y separado
// del layout desktop/tablet de Dashboard.jsx: nunca edita ni reimplementa
// PlanoGrid.jsx/PlanoViewport.jsx (los importa y los usa tal cual, vía los
// mismos props/handlers que ya calcula Dashboard.jsx — mismas unidades,
// mismo orden, misma disposición real). `renderCelda` que recibe ya es
// renderCeldaMobile (CellMobile.jsx, celda táctil real ≥44x36 — ver ese
// archivo y Dashboard.jsx), nunca Cell.jsx escalado. La grilla de
// "Pasillo A-B-C/D-E-F" del mock es un placeholder inventado por Stitch, acá
// se dibuja la disposición real vía `renderCelda`/`unidades`.
export default function PlanoMobile({
  selectedDate, esHoy, onPrevDay, onNextDay, onHoy, onDateChange,
  planoStats, loading, statsFiltro, onToggleFiltro,
  transform, ready, isDragging, canPan,
  onZoomIn, onZoomOut, onEncuadrar, onTouchStart, onTouchMove, onTouchEnd,
  onMapMouseDown, onMapWheel, onAnimationEnd, viewportRef, contentRef,
  unidades, renderCelda, extraButtonsViewport,
}) {
  const kpis = planoStats && [
    { key: 'ocupacion', label: 'Ocupadas', value: planoStats.ocupacion.count, sub: `${pct(planoStats.ocupacion.pct)}`, progress: planoStats.ocupacion.pct, tone: 'black' },
    { key: 'libres', label: 'Libres', value: planoStats.libres.count, sub: `${pct(planoStats.libres.pct ?? (planoStats.libres.count / Math.max(1, planoStats.ocupacion.total)))}`, progress: planoStats.libres.count / Math.max(1, planoStats.ocupacion.total), tone: 'success' },
    { key: 'pendientes', label: 'Pendientes', value: planoStats.pendientes.count, sub: planoStats.pendientes.saldo > 0 ? formatPesosCompacto(planoStats.pendientes.saldo) : null, progress: planoStats.pendientes.count / Math.max(1, planoStats.ocupacion.total), tone: 'gold' },
  ]

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Fecha + Imprimir */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-inner flex-1 min-w-0">
          <button onClick={onPrevDay} className="w-11 h-11 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full bg-card text-ink-2" title="Día anterior">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-1">
            {/* w-[164px] (no 92px): la fecha completa dd/mm/aaaa no entraba,
                se veía cortada ("01/0" en vez de "01/01/2027") — ver reporte
                de la tarea. */}
            <DateInput value={selectedDate} onChange={(v) => v && onDateChange(v)} calendarOnly className="w-[164px]" />
            {!esHoy && (
              <button onClick={onHoy} className="text-label text-ink shrink-0 min-h-11 px-2">Hoy</button>
            )}
          </div>
          <button onClick={onNextDay} className="w-11 h-11 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full bg-card text-ink-2" title="Día siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={() => window.print()} className="card-surface w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-ink-2" title="Imprimir A4">
          <Printer size={18} />
        </button>
      </div>

      {/* 3 KPIs con barra */}
      {kpis && (
        <div className="grid grid-cols-3 gap-2 shrink-0">
          {kpis.map((k) => (
            <button
              key={k.key}
              onClick={() => onToggleFiltro(k.key)}
              className={`text-left rounded-inner p-3 border transition-colors ${statsFiltro === k.key ? 'border-gold-300 bg-gold-100' : 'border-line bg-card'}`}
            >
              <span className="block text-label text-ink-2 truncate">{k.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-body text-ink tabular-nums">{k.value}</span>
                {k.sub && <span className="text-label text-ink-2 truncate">{k.sub}</span>}
              </div>
              <div className="mt-2 h-1 rounded-full bg-surface overflow-hidden">
                <div
                  className={`h-full rounded-full ${k.tone === 'success' ? 'bg-success' : k.tone === 'gold' ? 'bg-gold' : 'bg-ink'}`}
                  style={{ width: `${Math.min(100, Math.round((k.progress || 0) * 100))}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filtros de tipo/estado ocultos en mobile (pulido UX, oct 2026, item
          6) — solo viven en desktop/tablet (Dashboard.jsx). El plano sube y
          aprovecha el espacio que dejan. Los chips todavía se pueden
          "activar" por código desde las 3 KPI cards de arriba (onToggleFiltro
          sigue intacto), esto solo saca la UI redundante de filtro manual. */}

      {/* Leyenda — explica los 6 indicadores reales (ver PlanoLeyenda.jsx),
          no solo los 3 colores de fondo. */}
      <PlanoLeyenda compact />

      {/* Card del plano — PlanoGrid/PlanoViewport SIN modificar */}
      <section className="card-surface flex-1 min-h-0 relative overflow-hidden flex flex-col">
        <div className="px-3 pt-3 flex items-center gap-2 text-ink-2 shrink-0">
          <Layers size={14} />
          <span className="text-label">Pasillo A · B · C</span>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ink-2 text-label">Cargando plano…</div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-2 px-2 pb-2">
            {/* Misma técnica que Dashboard.jsx desktop: la barra de zoom
                propia de PlanoViewport.jsx (congelado) se oculta desde
                afuera con este selector, sin tocar ese archivo —
                PlanoZoomBar.jsx la reemplaza al lado, dentro del padding de
                la card, nunca superpuesta a una celda. */}
            <div className="flex-1 min-h-0 flex flex-col relative [&>div:first-child]:hidden">
              <PlanoViewport
                transform={transform}
                ready={ready}
                isDragging={isDragging}
                canPan={canPan}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onEncuadrar={onEncuadrar}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMapMouseDown={onMapMouseDown}
                onMapWheel={onMapWheel}
                onAnimationEnd={onAnimationEnd}
                viewportRef={viewportRef}
                contentRef={contentRef}
              >
                <PlanoGrid unidades={unidades} renderCelda={renderCelda} />
              </PlanoViewport>
            </div>
            <PlanoZoomBar onZoomIn={onZoomIn} onZoomOut={onZoomOut} onEncuadrar={onEncuadrar} extraButtons={extraButtonsViewport} />
          </div>
        )}
      </section>
    </div>
  )
}


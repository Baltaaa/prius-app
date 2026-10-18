import { ChevronLeft, ChevronRight, Printer, Layers } from "lucide-react"
import PlanoGrid from "../plano/PlanoGrid"
import PlanoViewport from "../plano/PlanoViewport"
import DateInput from "../inputs/DateInput"
import PlanoZoomBar from "./PlanoZoomBar"
import PlanoLeyenda from "./PlanoLeyenda"
import { pct } from "./PlanoStatsBar"

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
    { key: 'pendientes', label: 'Pendientes', value: planoStats.pendientes.count, sub: planoStats.pendientes.saldo > 0 ? formatCompacto(planoStats.pendientes.saldo) : null, progress: planoStats.pendientes.count / Math.max(1, planoStats.ocupacion.total), tone: 'gold' },
  ]

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Fecha + Imprimir */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-prius-subtle p-1 rounded-xl flex-1 min-w-0">
          <button onClick={onPrevDay} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-white text-prius-slate" title="Día anterior">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1">
            {/* w-[164px] (no 92px): la fecha completa dd/mm/aaaa no entraba,
                se veía cortada ("01/0" en vez de "01/01/2027") — ver reporte
                de la tarea. */}
            <DateInput value={selectedDate} onChange={(v) => v && onDateChange(v)} calendarOnly className="w-[164px]" />
            {!esHoy && (
              <button onClick={onHoy} className="text-label-md text-gold font-bold uppercase shrink-0">Hoy</button>
            )}
          </div>
          <button onClick={onNextDay} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-white text-prius-slate" title="Día siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={() => window.print()} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl card-light text-prius-slate" title="Imprimir A4">
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
              className={`text-left rounded-xl p-2.5 border transition-colors ${statsFiltro === k.key ? 'border-gold/50 bg-gold/10' : 'border-hairline bg-white'}`}
            >
              <span className="block text-label-md text-prius-slate uppercase truncate">{k.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-headline-sm text-black tabular-nums">{k.value}</span>
                {k.sub && <span className="text-body-sm text-prius-slate truncate">{k.sub}</span>}
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-prius-surface overflow-hidden">
                <div
                  className={`h-full rounded-full ${k.tone === 'success' ? 'bg-prius-success' : k.tone === 'gold' ? 'bg-gold' : 'bg-black'}`}
                  style={{ width: `${Math.min(100, Math.round((k.progress || 0) * 100))}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filtro por tipo */}
      <div className="flex items-center overflow-x-auto scrollbar-none shrink-0">
        <div className="flex items-center bg-prius-subtle p-1 rounded-full gap-0.5 shrink-0">
          {[['todo', 'Todo', planoStats?.ocupacion.total], ['carpas', 'Carpas', planoStats?.carpas.total], ['sombrillas', 'Sombrillas', planoStats?.sombrillas.total]].map(([key, label, total]) => (
            <button
              key={key}
              onClick={() => onToggleFiltro(key === 'todo' ? null : key)}
              className={`px-3 py-1 rounded-full text-label-lg whitespace-nowrap transition-colors ${
                (key === 'todo' ? !statsFiltro : statsFiltro === key) ? 'bg-black text-white' : 'text-prius-slate'
              }`}
            >
              {label}{total != null ? ` (${total})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por estado — fila propia (oct 2026): antes compartía el
          mismo renglón con scroll horizontal que el filtro de tipo, así que
          "Pendientes" quedaba fuera de vista sin que se notara que había
          que scrollear. Ahora siempre visible. */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {[['todas', 'Todas', null], ['libres', 'Libres', planoStats?.libres.count], ['ocupacion', 'Ocupadas', planoStats?.ocupacion.count], ['pendientes', 'Pendientes', planoStats?.pendientes.count]].map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => onToggleFiltro(key === 'todas' ? null : key)}
            className={`h-7 px-2.5 rounded-full text-label-md uppercase whitespace-nowrap shrink-0 transition-colors ${
              (key === 'todas' ? !statsFiltro : statsFiltro === key) ? 'bg-gold text-black' : 'bg-prius-subtle text-prius-slate'
            }`}
          >
            {label}{count != null ? ` (${count})` : ''}
          </button>
        ))}
      </div>

      {/* Leyenda — explica los 6 indicadores reales (ver PlanoLeyenda.jsx),
          no solo los 3 colores de fondo. */}
      <PlanoLeyenda compact />

      {/* Card del plano — PlanoGrid/PlanoViewport SIN modificar */}
      <section className="flex-1 min-h-0 card-light rounded-2xl card-light-inner relative overflow-hidden flex flex-col">
        <div className="px-3 pt-2.5 flex items-center gap-1.5 text-prius-slate shrink-0">
          <Layers size={14} />
          <span className="text-label-md uppercase tracking-wider">Pasillo A · B · C</span>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-prius-muted text-label-md">Cargando plano…</div>
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

function formatCompacto(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

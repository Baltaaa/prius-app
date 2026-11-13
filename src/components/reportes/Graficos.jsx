import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis, Legend,
} from 'recharts'
import { useTema } from '../../context/TemaProvider'
import { tokensTema, MARCA, colorIngresos, colorNeutro, EGRESO_F, EGRESO_SF } from '../../lib/chartTheme'
import { formatMontoCompacto, formatMonto, formatPorcentaje } from '../../lib/format'

// Gráficos de Reportes (nov 2026). Todos comparten:
//  * La paleta y las especificaciones de marca de lib/chartTheme.js — acá no
//    se inventa ningún color.
//  * Capa de hover por defecto: tooltip propio (el de recharts no respeta los
//    tokens del tema) que se dispara también por tap en mobile.
//  * Un `<table className="sr-only">` con los mismos datos: el gráfico nunca
//    es la única forma de leer el número.
//  * Montos con los formateadores únicos de la app, así respetan el modo
//    privacidad. En los ejes van compactos ($1,2M) para que entren.
//  * Un solo eje Y. Nunca dos escalas en el mismo gráfico.

const ALTO = 'h-56 md:h-64'

export function useOscuro() {
  const tema = useTema()
  return tema?.resuelto === 'dark'
}

/** Tooltip común: card del tema, montos formateados, texto en tokens de texto. */
function TooltipPrius({ active, payload, label, formato = formatMonto, sufijoLabel = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface-pop px-3 py-2">
      {label != null && <p className="text-label text-ink-2">{label}{sufijoLabel}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="text-body text-ink tabular-nums whitespace-nowrap flex items-center gap-2">
          <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || p.payload?.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="font-semibold">{formato(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function TablaSrOnly({ columnas, filas, caption }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{columnas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>
        {filas.map((f, i) => <tr key={i}>{f.map((celda, j) => <td key={j}>{celda}</td>)}</tr>)}
      </tbody>
    </table>
  )
}

/**
 * Serie de barras de una sola medida en el tiempo. Una serie = sin leyenda:
 * el título de la card la nombra.
 */
export function BarrasEnElTiempo({ datos, clave = 'ingresos', nombre = 'Ingresos', descripcion }) {
  const oscuro = useOscuro()
  const t = tokensTema(oscuro)
  const color = colorIngresos(oscuro)
  return (
    <>
      <div className={ALTO} role="img" aria-label={descripcion}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={t.grilla} />
            <XAxis dataKey="label" tick={{ fill: t.texto, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickFormatter={formatMontoCompacto} tick={{ fill: t.texto, fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
            <Tooltip content={<TooltipPrius />} cursor={{ fill: t.grilla }} />
            <Bar dataKey={clave} name={nombre} fill={color} radius={MARCA.radioBarra} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TablaSrOnly caption={descripcion} columnas={['Período', nombre]} filas={datos.map((d) => [d.label, formatMonto(d[clave])])} />
    </>
  )
}

/**
 * Egresos apilados F vs SF en el tiempo. Dos series, así que leyenda siempre
 * presente; los 2px de separación entre rellenos los da `stackGap`.
 */
export function BarrasApiladasFSF({ datos, descripcion }) {
  const oscuro = useOscuro()
  const t = tokensTema(oscuro)
  const colorF = oscuro ? EGRESO_F.oscuro : EGRESO_F.claro
  const colorSF = oscuro ? EGRESO_SF.oscuro : EGRESO_SF.claro
  return (
    <>
      <div className={ALTO} role="img" aria-label={descripcion}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} stackOffset="none">
            <CartesianGrid vertical={false} stroke={t.grilla} />
            <XAxis dataKey="label" tick={{ fill: t.texto, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickFormatter={formatMontoCompacto} tick={{ fill: t.texto, fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
            <Tooltip content={<TooltipPrius />} cursor={{ fill: t.grilla }} />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="circle"
              iconSize={9}
              formatter={(v) => <span style={{ color: t.texto, fontSize: 12 }}>{v}</span>}
            />
            {/* El apilado va SF abajo y F arriba: el dato que el dueño busca
                (lo que sí tiene factura) queda coronando la barra. */}
            <Bar dataKey="egresos_sf" stackId="e" name="Sin factura (SF)" fill={colorSF} maxBarSize={40} />
            <Bar dataKey="egresos_f" stackId="e" name="Con factura (F)" fill={colorF} radius={MARCA.radioBarra} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TablaSrOnly
        caption={descripcion}
        columnas={['Período', 'Sin factura', 'Con factura', 'Total']}
        filas={datos.map((d) => [d.label, formatMonto(d.egresos_sf), formatMonto(d.egresos_f), formatMonto(d.egresos_sf + d.egresos_f)])}
      />
    </>
  )
}

/**
 * Dona con leyenda de monto y porcentaje al lado. La leyenda ESCRITA es el
 * "relieve" que pide el amarillo en claro: la identidad y el valor nunca
 * dependen del color.
 */
export function Dona({ datos, total, descripcion, etiquetaCentro }) {
  const suma = total ?? datos.reduce((acc, d) => acc + d.valor, 0)
  const conPct = useMemo(
    () => datos.map((d) => ({ ...d, pct: suma > 0 ? (d.valor / suma) * 100 : 0 })),
    [datos, suma],
  )
  if (!datos.length) return <p className="text-label text-ink-2">Sin datos en el período.</p>
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="h-40 w-40 shrink-0 self-center relative" role="img" aria-label={descripcion}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={conPct}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {conPct.map((d) => <Cell key={d.nombre} fill={d.color} />)}
            </Pie>
            <Tooltip content={<TooltipPrius />} />
          </PieChart>
        </ResponsiveContainer>
        {etiquetaCentro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-label text-ink-2">{etiquetaCentro.label}</span>
            <span className="text-body font-semibold text-ink tabular-nums">{etiquetaCentro.valor}</span>
          </div>
        )}
      </div>
      <ul className="flex-1 min-w-0 space-y-2">
        {conPct.map((d) => (
          <li key={d.nombre} className="flex items-center gap-2 min-w-0">
            <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-body text-ink truncate" title={d.agrupadas ? `${d.agrupadas} categorías` : d.nombre}>{d.nombre}</span>
            <span className="flex-1" />
            <span className="text-body text-ink tabular-nums shrink-0">{formatMonto(d.valor)}</span>
            <span className="text-label text-ink-2 tabular-nums shrink-0 w-12 text-right">{formatPorcentaje(d.pct, 1)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras horizontales: una categoría por fila, monto escrito a la derecha. */
export function BarrasHorizontales({ datos, descripcion }) {
  const max = Math.max(...datos.map((d) => d.valor), 1)
  if (!datos.length) return <p className="text-label text-ink-2">Sin datos en el período.</p>
  return (
    <div className="space-y-3" role="img" aria-label={descripcion}>
      {datos.map((d) => (
        <div key={d.nombre}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body text-ink truncate min-w-0" title={d.nombre}>{d.etiqueta || d.nombre}</span>
            <span className="text-body text-ink tabular-nums shrink-0">{formatMonto(d.valor)}</span>
          </div>
          <span className="block w-full h-2 mt-2 rounded-full bg-surface overflow-hidden">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(d.valor / max) * 100}%`, background: d.color }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Ocupación % en el tiempo. Una sola serie, un solo eje. */
export function LineaOcupacion({ datos, descripcion }) {
  const oscuro = useOscuro()
  const t = tokensTema(oscuro)
  const color = colorIngresos(oscuro)
  const fmt = (v) => formatPorcentaje(v, 0)
  return (
    <>
      <div className={ALTO} role="img" aria-label={descripcion}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={t.grilla} />
            <XAxis dataKey="label" tick={{ fill: t.texto, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis domain={[0, 100]} tickFormatter={fmt} tick={{ fill: t.texto, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<TooltipPrius formato={fmt} />} />
            <Line
              type="monotone"
              dataKey="ocupacion_pct"
              name="Ocupación"
              stroke={color}
              strokeWidth={MARCA.grosorLinea}
              dot={{ r: MARCA.radioMarcador, fill: color, stroke: t.superficie, strokeWidth: MARCA.separacion }}
              activeDot={{ r: MARCA.radioMarcador + 2, fill: color, stroke: t.superficie, strokeWidth: MARCA.separacion }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TablaSrOnly caption={descripcion} columnas={['Período', 'Ocupación']} filas={datos.map((d) => [d.label, fmt(d.ocupacion_pct)])} />
    </>
  )
}

/** Anillo de ocupación: el número grande adentro, el aro como apoyo. */
export function AnilloOcupacion({ pct, label, sub }) {
  const oscuro = useOscuro()
  const t = tokensTema(oscuro)
  const color = colorIngresos(oscuro)
  const valor = pct == null ? 0 : Number(pct)
  return (
    <div className="relative h-36 w-36 mx-auto" role="img" aria-label={`${label}: ${pct == null ? 'sin datos' : formatPorcentaje(valor, 1)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ name: label, value: valor }]}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" cornerRadius={4} fill={color} background={{ fill: t.grilla }} isAnimationActive={false} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
        <span className="text-card-title text-ink tabular-nums">{pct == null ? '—' : formatPorcentaje(valor, 0)}</span>
        {sub && <span className="text-label text-ink-2">{sub}</span>}
      </div>
    </div>
  )
}

/** Sparkline del hero: sin ejes ni leyenda, solo la forma de la tendencia. */
export function Sparkline({ datos, clave = 'neto', className = '' }) {
  const oscuro = useOscuro()
  const color = colorIngresos(oscuro)
  const puntos = (datos || []).filter((d) => d[clave] != null)
  if (puntos.length < 2) return null
  return (
    <div className={`h-12 ${className}`} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={puntos} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <Line type="monotone" dataKey={clave} stroke={color} strokeWidth={MARCA.grosorLinea} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barra de progreso de la temporada: comprometido / cobrado / por cobrar. */
export function ProgresoTemporada({ comprometido, cobrado, porCobrar, pct }) {
  const oscuro = useOscuro()
  const color = colorIngresos(oscuro)
  const neutro = colorNeutro(oscuro)
  const ancho = comprometido > 0 ? Math.min(100, (cobrado / comprometido) * 100) : 0
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-label text-ink-2">Cobrado</p>
          <p className="text-card-title text-ink tabular-nums">{formatMonto(cobrado)}</p>
        </div>
        <div className="text-right">
          <p className="text-label text-ink-2">Por cobrar</p>
          <p className="text-body text-ink tabular-nums">{formatMonto(porCobrar)}</p>
        </div>
      </div>
      <span className="block w-full h-3 rounded-full overflow-hidden bg-surface">
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${ancho}%`, background: color }} />
      </span>
      <div className="flex items-center justify-between gap-3 text-label text-ink-2">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          {pct == null ? 'Sin datos para comparar' : `${formatPorcentaje(pct, 1)} del total comprometido`}
        </span>
        <span className="inline-flex items-center gap-2 tabular-nums">
          <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ background: neutro }} />
          Comprometido {formatMonto(comprometido)}
        </span>
      </div>
    </div>
  )
}

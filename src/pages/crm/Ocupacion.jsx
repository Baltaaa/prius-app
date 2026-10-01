import { useMemo, useState } from 'react'
import { useData } from '../../context/DataProvider'
import { unidadEmoji, formatFecha } from '../../lib/format'
import ReservaDetalleModal from '../../components/crm/ReservaDetalleModal'
import DateInput from '../../components/inputs/DateInput'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Vista tipo Gantt: una fila por unidad, una barra por reserva mostrando su
// rango de fechas. Sección nueva, separada del Plano (que solo muestra el
// estado de HOY/una fecha puntual) — acá se ve la ocupación en un rango.
// No confundir con "Línea de Tiempo" (/app/actividad, log de auditoría de
// la tabla eventos): esto es un calendario visual de reservas, no un log.

const TIPO_LABEL = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }
const FILTROS_TIPO = ['todos', 'carpa', 'sombrilla', 'cabina', 'locker']

// Mismo esquema de color que el Plano (Cell.jsx): temporada dorado, período
// slate, día gris claro — para que un usuario que ya conoce el Plano
// reconozca los mismos colores acá.
const COLOR_BARRA = {
  temporada: 'bg-[#FDE047] border-[#FDE047]',
  periodo: 'bg-slate-500 border-slate-400',
  dia: 'bg-gray-300 border-gray-200',
  cancelada: 'bg-red-500/30 border-red-500/50',
}

const toUTC = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000)
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}
const todayStr = () => new Date().toISOString().split('T')[0]

// Rango de fechas real que ocupa una reserva. Temporada no tiene fecha propia
// (ver CLAUDE.md "Reservas vs Clientes") — se resuelve contra `temporadas`
// vía temporada_id, igual que el exclusion constraint de la base.
function rangoEfectivo(r, temporadasPorId) {
  if (r.tipo_alquiler === 'dia') return r.fecha ? [r.fecha, r.fecha] : null
  if (r.tipo_alquiler === 'periodo') return r.fecha_inicio && r.fecha_fin ? [r.fecha_inicio, r.fecha_fin] : null
  if (r.tipo_alquiler === 'temporada') {
    const t = temporadasPorId[r.temporada_id]
    return t ? [t.fecha_inicio, t.fecha_fin] : null
  }
  return null
}

export default function Ocupacion() {
  const { reservas, unidades, temporadas, loading } = useData()
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [desde, setDesde] = useState(() => addDays(todayStr(), -3))
  const [hasta, setHasta] = useState(() => addDays(todayStr(), 24))
  const [reservaDetalle, setReservaDetalle] = useState(null)

  const temporadasPorId = useMemo(() => {
    const map = {}
    for (const t of temporadas) map[t.id] = t
    return map
  }, [temporadas])

  const totalDias = Math.max(1, diffDays(desde, hasta) + 1)

  const shiftRango = (dias) => {
    setDesde((d) => addDays(d, dias))
    setHasta((h) => addDays(h, dias))
  }

  const unidadesFiltradas = useMemo(
    () =>
      unidades
        .filter((u) => tipoFiltro === 'todos' || u.tipo === tipoFiltro)
        .sort((a, b) => (a.tipo === b.tipo ? a.numero - b.numero : a.tipo.localeCompare(b.tipo))),
    [unidades, tipoFiltro],
  )

  // Reservas por unidad, ya recortadas contra [desde, hasta] y con su
  // posición/ancho en % calculados una sola vez acá (no por render de barra).
  const barrasPorUnidad = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      if (!r.unidad_id) continue
      const rango = rangoEfectivo(r, temporadasPorId)
      if (!rango) continue
      const [rIni, rFin] = rango
      if (rFin < desde || rIni > hasta) continue // sin overlap con el rango visible
      const clipIni = rIni < desde ? desde : rIni
      const clipFin = rFin > hasta ? hasta : rFin
      const offsetDias = diffDays(desde, clipIni)
      const largoDias = diffDays(clipIni, clipFin) + 1
      const color = r.estado === 'cancelada' ? COLOR_BARRA.cancelada : COLOR_BARRA[r.tipo_alquiler] || COLOR_BARRA.dia
      const barra = {
        reserva: r,
        left: (offsetDias / totalDias) * 100,
        width: (largoDias / totalDias) * 100,
        color,
        recortadaIzq: rIni < desde,
        recortadaDer: rFin > hasta,
      }
      ;(map[r.unidad_id] ||= []).push(barra)
    }
    return map
  }, [reservas, temporadasPorId, desde, hasta, totalDias])

  // Marcas de fecha en el header: una por día si el rango es corto, cada 3+
  // días si es largo, para no amontonar etiquetas.
  const marcas = useMemo(() => {
    const paso = totalDias <= 21 ? 1 : totalDias <= 60 ? 3 : 7
    const out = []
    for (let i = 0; i < totalDias; i += paso) out.push({ dia: addDays(desde, i), left: (i / totalDias) * 100 })
    return out
  }, [desde, totalDias])

  const hoyOffset = useMemo(() => {
    const t = todayStr()
    if (t < desde || t > hasta) return null
    return (diffDays(desde, t) / totalDias) * 100
  }, [desde, hasta, totalDias])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Cargando ocupación...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftRango(-7)}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
            title="Retroceder una semana"
          >
            <ChevronLeft size={16} />
          </button>
          <DateInput value={desde} onChange={(v) => v && setDesde(v)} className="w-36" />
          <span className="text-gray-600 text-xs">→</span>
          <DateInput value={hasta} onChange={(v) => v && setHasta(v)} min={desde} className="w-36" />
          <button
            onClick={() => shiftRango(7)}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
            title="Avanzar una semana"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="glass-card p-1 rounded-xl flex flex-wrap">
          {FILTROS_TIPO.map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                tipoFiltro === t ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'todos' ? 'Todas' : TIPO_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FDE047]" /> Temporada</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-500" /> Período</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-300" /> Día</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" /> Cancelada</span>
        </div>
      </div>

      <div className="glass-card rounded-3xl glass-card-inner overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header de fechas */}
            <div className="flex border-b border-white/10 sticky top-0 bg-[#0a0d14] z-10">
              <div className="w-36 shrink-0 px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-gray-500">Unidad</div>
              <div className="flex-1 relative h-9">
                {marcas.map((m) => (
                  <div
                    key={m.dia}
                    className="absolute top-0 h-full border-l border-white/5 pl-1.5 text-[9px] text-gray-500 font-bold flex items-center"
                    style={{ left: `${m.left}%` }}
                  >
                    {formatFecha(m.dia).slice(0, 5)}
                  </div>
                ))}
              </div>
            </div>

            {/* Filas por unidad */}
            <div className="divide-y divide-white/5">
              {unidadesFiltradas.map((u) => {
                const barras = barrasPorUnidad[u.id] || []
                return (
                  <div key={u.id} className="flex items-stretch hover:bg-white/5 transition-all">
                    <div className="w-36 shrink-0 px-4 py-2.5 flex items-center gap-1.5 text-xs font-bold text-gray-300 uppercase">
                      {unidadEmoji(u.tipo)} {u.tipo} #{u.numero}
                    </div>
                    <div className="flex-1 relative h-9 my-auto">
                      {marcas.map((m) => (
                        <div key={m.dia} className="absolute top-0 h-full border-l border-white/5" style={{ left: `${m.left}%` }} />
                      ))}
                      {hoyOffset !== null && (
                        <div className="absolute top-0 h-full border-l-2 border-[#FDE047]/60 z-10" style={{ left: `${hoyOffset}%` }} />
                      )}
                      {barras.map((b, i) => (
                        <button
                          key={`${b.reserva.id}-${i}`}
                          type="button"
                          onClick={() => setReservaDetalle(b.reserva)}
                          title={`${b.reserva.clientes?.nombre || 'S/N'} — ${formatFecha(b.reserva.fecha_inicio || b.reserva.fecha)} a ${formatFecha(b.reserva.fecha_fin || b.reserva.fecha)}`}
                          className={`absolute top-1.5 h-6 border text-[9px] font-bold text-black/80 uppercase truncate px-1.5 flex items-center transition-all hover:brightness-110 ${b.color} ${
                            b.recortadaIzq ? 'rounded-l-none' : 'rounded-l-md'
                          } ${b.recortadaDer ? 'rounded-r-none' : 'rounded-r-md'}`}
                          style={{ left: `${b.left}%`, width: `${b.width}%`, minWidth: 6 }}
                        >
                          {b.width > 6 && (b.reserva.clientes?.nombre || 'S/N')}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              {unidadesFiltradas.length === 0 && (
                <div className="px-8 py-10 text-center text-gray-600 uppercase text-xs tracking-widest">Sin unidades para este filtro.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReservaDetalleModal reserva={reservaDetalle} onClose={() => setReservaDetalle(null)} />
    </div>
  )
}

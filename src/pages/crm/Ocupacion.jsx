import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../../context/DataProvider'
import { unidadEmoji, formatFecha, formatRangoFechas, formatMesAnio } from '../../lib/format'
import { COLOR_TIPO_ALQUILER, colorReserva } from '../../lib/colors'
import { linkToPlano } from '../../lib/deepLinks'
import ReservaDetalleModal from '../../components/crm/ReservaDetalleModal'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Vista de ocupación en un rango de fechas — distinta del Plano (que solo
// muestra el estado de HOY/una fecha puntual). No confundir con "Historial"
// (/app/historial, log de auditoría de la tabla eventos — antes "Línea de
// Tiempo"): esto es un calendario visual de reservas, no un log.
//
// Rediseño Tarea 6 (oct 2026): dos vistas (Semana: Gantt por unidad, Mes:
// heatmap de % ocupación + KPIs), colores por tipo_alquiler compartidos
// con el Plano (lib/colors.ts, ya no duplicados a mano acá).

const TIPO_LABEL = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }
const FILTROS_TIPO = ['todos', 'carpa', 'sombrilla', 'cabina', 'locker']

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
const addMonths = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return dt.toISOString().split('T')[0]
}
const todayStr = () => new Date().toISOString().split('T')[0]
const diasDelMes = (anchorIso) => {
  const [y, m] = anchorIso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: ultimo }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
}

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

const SWIPE_THRESHOLD = 60

export default function Ocupacion() {
  const { reservas, unidades, temporadas, loading } = useData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [reservaDetalle, setReservaDetalle] = useState(null)

  // vista/fecha en la URL (linkToOcupacion, Tarea 1/6) — compartible y
  // sobrevive a recargar/atrás.
  const vista = searchParams.get('vista') === 'mes' ? 'mes' : 'semana'
  const anchor = searchParams.get('fecha') || todayStr()
  const setVista = (v) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    v === 'semana' ? next.delete('vista') : next.set('vista', v)
    return next
  }, { replace: true })
  const setAnchor = (f) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    f === todayStr() ? next.delete('fecha') : next.set('fecha', f)
    return next
  }, { replace: true })

  const desde = vista === 'semana' ? anchor : diasDelMes(anchor)[0]
  const hasta = vista === 'semana' ? addDays(anchor, 6) : diasDelMes(anchor).slice(-1)[0]
  const totalDias = Math.max(1, diffDays(desde, hasta) + 1)

  const irAnterior = () => setAnchor(vista === 'semana' ? addDays(anchor, -7) : addMonths(anchor, -1))
  const irSiguiente = () => setAnchor(vista === 'semana' ? addDays(anchor, 7) : addMonths(anchor, 1))
  const irHoy = () => setAnchor(todayStr())

  // Swipe horizontal (mobile, Tarea 6): mismo patrón que Notificaciones.jsx.
  const dragRef = useRef({ startX: 0, active: false })
  const handlePointerDown = (e) => { dragRef.current = { startX: e.clientX, active: true } }
  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    dragRef.current.active = false
    if (dx > SWIPE_THRESHOLD) irAnterior()
    else if (dx < -SWIPE_THRESHOLD) irSiguiente()
  }

  const temporadasPorId = useMemo(() => {
    const map = {}
    for (const t of temporadas) map[t.id] = t
    return map
  }, [temporadas])

  const unidadesFiltradas = useMemo(
    () =>
      unidades
        .filter((u) => tipoFiltro === 'todos' || u.tipo === tipoFiltro)
        .sort((a, b) => (a.tipo === b.tipo ? a.numero - b.numero : a.tipo.localeCompare(b.tipo))),
    [unidades, tipoFiltro],
  )

  // ---- Vista Semana: barras por unidad (Gantt), igual que antes ----
  const barrasPorUnidad = useMemo(() => {
    if (vista !== 'semana') return {}
    const map = {}
    for (const r of reservas) {
      if (!r.unidad_id) continue
      const rango = rangoEfectivo(r, temporadasPorId)
      if (!rango) continue
      const [rIni, rFin] = rango
      if (rFin < desde || rIni > hasta) continue
      const clipIni = rIni < desde ? desde : rIni
      const clipFin = rFin > hasta ? hasta : rFin
      const offsetDias = diffDays(desde, clipIni)
      const largoDias = diffDays(clipIni, clipFin) + 1
      const barra = {
        reserva: r,
        left: (offsetDias / totalDias) * 100,
        width: (largoDias / totalDias) * 100,
        color: colorReserva(r.tipo_alquiler, r.estado),
        pendienteConfirmacion: r.estado_pago === 'pendiente_confirmacion',
        bonificada: !!r.bonificada,
        recortadaIzq: rIni < desde,
        recortadaDer: rFin > hasta,
      }
      ;(map[r.unidad_id] ||= []).push(barra)
    }
    return map
  }, [vista, reservas, temporadasPorId, desde, hasta, totalDias])

  const marcas = useMemo(() => {
    if (vista !== 'semana') return []
    const paso = totalDias <= 21 ? 1 : totalDias <= 60 ? 3 : 7
    const out = []
    for (let i = 0; i < totalDias; i += paso) out.push({ dia: addDays(desde, i), left: (i / totalDias) * 100 })
    return out
  }, [vista, desde, totalDias])

  const hoyOffsetSemana = useMemo(() => {
    if (vista !== 'semana') return null
    const t = todayStr()
    if (t < desde || t > hasta) return null
    return (diffDays(desde, t) / totalDias) * 100
  }, [vista, desde, hasta, totalDias])

  // ---- Vista Mes: % ocupación + mini stacked bar por día ----
  const diasMes = useMemo(() => (vista === 'mes' ? diasDelMes(anchor) : []), [vista, anchor])

  const ocupacionPorDia = useMemo(() => {
    if (vista !== 'mes' || diasMes.length === 0) return {}
    const unidadIds = new Set(unidadesFiltradas.map((u) => u.id))
    const map = {}
    for (const d of diasMes) map[d] = { ocupadas: new Set(), porTipo: { temporada: 0, periodo: 0, dia: 0 } }
    const mIni = diasMes[0]
    const mFin = diasMes[diasMes.length - 1]
    for (const r of reservas) {
      if (r.estado === 'cancelada' || !unidadIds.has(r.unidad_id)) continue
      const rango = rangoEfectivo(r, temporadasPorId)
      if (!rango) continue
      const [rIni, rFin] = rango
      if (rFin < mIni || rIni > mFin) continue
      const clipIni = rIni < mIni ? mIni : rIni
      const clipFin = rFin > mFin ? mFin : rFin
      for (let cursor = clipIni; cursor <= clipFin; cursor = addDays(cursor, 1)) {
        const bucket = map[cursor]
        if (!bucket || bucket.ocupadas.has(r.unidad_id)) continue
        bucket.ocupadas.add(r.unidad_id)
        bucket.porTipo[r.tipo_alquiler] = (bucket.porTipo[r.tipo_alquiler] || 0) + 1
      }
    }
    return map
  }, [vista, diasMes, reservas, temporadasPorId, unidadesFiltradas])

  const totalUnidadesFiltradas = unidadesFiltradas.length || 1

  // KPIs del mes + "hoy" (unidades libres/desglose siempre son de HOY,
  // independiente del mes que se esté mirando).
  const kpisMes = useMemo(() => {
    if (vista !== 'mes' || diasMes.length === 0) return null
    const pcts = diasMes.map((d) => (ocupacionPorDia[d]?.ocupadas.size || 0) / totalUnidadesFiltradas * 100)
    const promedio = pcts.reduce((a, b) => a + b, 0) / pcts.length
    let diaPicoIdx = 0
    pcts.forEach((p, i) => { if (p > pcts[diaPicoIdx]) diaPicoIdx = i })
    const hoy = todayStr()
    const bucketHoy = ocupacionPorDia[hoy]
    const ocupadasHoy = bucketHoy?.ocupadas.size || 0
    return {
      promedio,
      diaPico: diasMes[diaPicoIdx],
      pctDiaPico: pcts[diaPicoIdx],
      libresHoy: Math.max(totalUnidadesFiltradas - ocupadasHoy, 0),
      porTipoHoy: bucketHoy?.porTipo || { temporada: 0, periodo: 0, dia: 0 },
    }
  }, [vista, diasMes, ocupacionPorDia, totalUnidadesFiltradas])

  const tituloRango = vista === 'semana' ? formatRangoFechas(desde, hasta, true) : formatMesAnio(anchor)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Cargando ocupación...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className="flex items-center gap-2">
          <div className="glass-card p-1 rounded-xl flex">
            {['semana', 'mes'].map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  vista === v ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                {v === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button onClick={irAnterior} className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all" title="Anterior">
            <ChevronLeft size={16} />
          </button>
          <button onClick={irSiguiente} className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all" title="Siguiente">
            <ChevronRight size={16} />
          </button>
          <button onClick={irHoy} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-300 transition-all">
            Hoy
          </button>
          <span className="text-sm font-bold text-white capitalize px-2">{tituloRango}</span>
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
      </div>

      {/* Leyenda fija y compacta — pendiente_confirmacion con contorno
          rayado del mismo color (no un color nuevo), bonificada con un
          punto sutil. */}
      <div className="flex flex-wrap items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: COLOR_TIPO_ALQUILER.temporada.swatch }} /> Temporada</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: COLOR_TIPO_ALQUILER.periodo.swatch }} /> Período</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: COLOR_TIPO_ALQUILER.dia.swatch }} /> Día</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-gray-400" /> Sin confirmar</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-400/30 border border-cyan-400/50" /> Bonificada</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" /> Cancelada</span>
      </div>

      {vista === 'mes' && kpisMes && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Ocupación promedio</p>
            <p className="text-xl font-bold text-white mt-1">{kpisMes.promedio.toFixed(0)}%</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Día pico</p>
            <p className="text-xl font-bold text-white mt-1">{formatFecha(kpisMes.diaPico)} <span className="text-xs text-gray-400">({kpisMes.pctDiaPico.toFixed(0)}%)</span></p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Unidades libres hoy</p>
            <p className="text-xl font-bold text-white mt-1">{kpisMes.libresHoy}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Hoy por tipo</p>
            <p className="text-xs font-bold text-white mt-1 space-x-2">
              <span style={{ color: COLOR_TIPO_ALQUILER.temporada.swatch }}>T {kpisMes.porTipoHoy.temporada}</span>
              <span style={{ color: COLOR_TIPO_ALQUILER.periodo.swatch }}>P {kpisMes.porTipoHoy.periodo}</span>
              <span className="text-gray-300">D {kpisMes.porTipoHoy.dia}</span>
            </p>
          </div>
        </div>
      )}

      {vista === 'semana' ? (
        <div className="glass-card rounded-3xl glass-card-inner overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
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

              {/* Fila de % de ocupación por día, arriba de las filas de unidad. */}
              <div className="flex border-b border-white/5 bg-white/[0.02]">
                <div className="w-36 shrink-0 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-gray-600">% ocupación</div>
                <div className="flex-1 relative h-6">
                  {marcas.map((m) => {
                    const ocupadasDia = unidadesFiltradas.filter((u) =>
                      (barrasPorUnidad[u.id] || []).some((b) => b.reserva.estado !== 'cancelada' && m.left >= b.left && m.left < b.left + b.width),
                    ).length
                    const pct = Math.round((ocupadasDia / totalUnidadesFiltradas) * 100)
                    return (
                      <div key={m.dia} className="absolute top-0 h-full flex items-center text-[9px] font-bold text-gray-500" style={{ left: `${m.left}%` }}>
                        <span className="pl-1.5">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

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
                        {hoyOffsetSemana !== null && (
                          <div className="absolute top-0 h-full border-l-2 border-[#FDE047]/60 z-10" style={{ left: `${hoyOffsetSemana}%` }} />
                        )}
                        {barras.map((b, i) => (
                          <button
                            key={`${b.reserva.id}-${i}`}
                            type="button"
                            onClick={() => setReservaDetalle(b.reserva)}
                            title={`${b.reserva.clientes?.nombre || 'S/N'} — ${formatFecha(b.reserva.fecha_inicio || b.reserva.fecha)} a ${formatFecha(b.reserva.fecha_fin || b.reserva.fecha)}`}
                            className={`absolute top-1.5 h-6 border text-[9px] font-bold uppercase truncate px-1.5 flex items-center gap-1 transition-all hover:brightness-110 ${b.color} ${
                              b.pendienteConfirmacion ? 'border-dashed border-2' : ''
                            } ${b.recortadaIzq ? 'rounded-l-none' : 'rounded-l-md'} ${b.recortadaDer ? 'rounded-r-none' : 'rounded-r-md'}`}
                            style={{ left: `${b.left}%`, width: `${b.width}%`, minWidth: 6 }}
                          >
                            {b.bonificada && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
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
      ) : (
        <div className="glass-card rounded-3xl glass-card-inner p-4">
          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-500">{d}</div>
            ))}
            {/* Relleno para que el día 1 caiga en su columna real de la semana (lunes=0). */}
            {Array.from({ length: (new Date(`${diasMes[0]}T12:00:00Z`).getUTCDay() + 6) % 7 }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {diasMes.map((d) => {
              const bucket = ocupacionPorDia[d] || { ocupadas: new Set(), porTipo: { temporada: 0, periodo: 0, dia: 0 } }
              const pct = Math.round((bucket.ocupadas.size / totalUnidadesFiltradas) * 100)
              const esHoy = d === todayStr()
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => navigate(linkToPlano(d))}
                  className={`aspect-square rounded-xl border p-2 flex flex-col items-center justify-between text-center transition-all hover:border-[#FDE047]/40 ${
                    esHoy ? 'border-[#FDE047] bg-[#FDE047]/5' : 'border-white/10 bg-white/[0.02]'
                  }`}
                  title={`${formatFecha(d)} — ${pct}% ocupado`}
                >
                  <span className={`text-xs font-bold ${esHoy ? 'text-[#FDE047]' : 'text-gray-300'}`}>{Number(d.slice(-2))}</span>
                  <span className="text-[10px] font-bold text-white">{pct}%</span>
                  <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                    {(['temporada', 'periodo', 'dia']).map((tipo) => {
                      const n = bucket.porTipo[tipo] || 0
                      if (!n) return null
                      return (
                        <span
                          key={tipo}
                          className="h-full"
                          style={{ width: `${(n / totalUnidadesFiltradas) * 100}%`, background: COLOR_TIPO_ALQUILER[tipo].swatch }}
                        />
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <ReservaDetalleModal reserva={reservaDetalle} onClose={() => setReservaDetalle(null)} />
    </div>
  )
}

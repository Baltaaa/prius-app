import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../../context/DataProvider'
import { formatFecha, formatRangoFechas, formatMesAnio, formatPorcentaje, formatUnidad, formatNombre} from '../../lib/format'
import { COLOR_TIPO_ALQUILER, colorReserva } from '../../lib/colors'
import { linkToPlano } from '../../lib/deepLinks'
import ReservaDetalleModal from '../../components/crm/ReservaDetalleModal'
import DateInput from '../../components/inputs/DateInput'
import { isFeatureEnabled } from '../../lib/features'
import { reservaActiva } from '../../lib/reservas'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import UnidadLabel from '../../components/crm/UnidadLabel'
import { hoyAR, sumarDias, sumarMeses } from '../../lib/fechas'

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
const addDays = sumarDias
const addMonths = sumarMeses
const todayStr = hoyAR
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
      if (!reservaActiva(r) || !unidadIds.has(r.unidad_id)) continue
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
        <span className="text-label text-ink-2 animate-pulse">Cargando ocupación...</span>
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
        {/* B6 (oct 2026): este grupo no entraba en 390px y desbordaba la
            página entera (la fecha quedaba directamente fuera de pantalla)
            — scroll horizontal interno acá, nunca scroll de la página. */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full">
          <div className="card-surface p-1 flex shrink-0">
            {['semana', 'mes'].map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-4 py-2 rounded-full text-label transition-all ${
                  vista === v ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {v === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button onClick={irAnterior} className="p-3 min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center bg-surface hover:bg-surface border border-line rounded-full text-ink-2 transition-all" title="Anterior">
            <ChevronLeft size={16} />
          </button>
          <button onClick={irSiguiente} className="p-3 min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center bg-surface hover:bg-surface border border-line rounded-full text-ink-2 transition-all" title="Siguiente">
            <ChevronRight size={16} />
          </button>
          <button onClick={irHoy} className="text-label px-3 py-3 shrink-0 bg-surface hover:bg-surface border border-line rounded-full text-ink-2 transition-all">
            Hoy
          </button>
          {/* [feat-5] "Ir a fecha": salta directo al día/semana/mes elegido
              sin tener que ir clickeando anterior/siguiente. */}
          {isFeatureEnabled('feat-5-ir-a-fecha') && (
            <DateInput value={anchor} onChange={(v) => v && setAnchor(v)} className="w-36 shrink-0" />
          )}
          <span className="text-body font-semibold text-ink capitalize px-2 shrink-0 whitespace-nowrap">{tituloRango}</span>
        </div>

        <div className="card-surface p-1 flex flex-wrap">
          {FILTROS_TIPO.map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-2 rounded-full text-label transition-all ${
                tipoFiltro === t ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink'
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
      <div className="text-label flex flex-wrap items-center gap-4 text-ink-2">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch" style={{ background: COLOR_TIPO_ALQUILER.temporada.swatch }} /> Temporada</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch" style={{ background: COLOR_TIPO_ALQUILER.periodo.swatch }} /> Período</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch" style={{ background: COLOR_TIPO_ALQUILER.dia.swatch }} /> Día</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch border-2 border-dashed border-line" /> Sin confirmar</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch bg-surface border border-line" /> Bonificada</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-swatch bg-danger-soft border border-danger/30" /> Cancelada</span>
      </div>

      {vista === 'mes' && kpisMes && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-grid">
          <div className="card-surface card-pad ">
            <p className="text-label text-ink-2">Ocupación promedio</p>
            <p className="text-card-title text-ink mt-1">{formatPorcentaje(kpisMes.promedio)}</p>
          </div>
          <div className="card-surface card-pad ">
            <p className="text-label text-ink-2">Día pico</p>
            <p className="text-card-title text-ink mt-1">{formatFecha(kpisMes.diaPico)} <span className="text-label text-ink-2">({formatPorcentaje(kpisMes.pctDiaPico)})</span></p>
          </div>
          <div className="card-surface card-pad ">
            <p className="text-label text-ink-2">Unidades libres hoy</p>
            <p className="text-card-title text-ink mt-1">{kpisMes.libresHoy}</p>
          </div>
          <div className="card-surface card-pad ">
            <p className="text-label text-ink-2">Hoy por tipo</p>
            <p className="text-label font-semibold text-ink mt-1 space-x-2">
              <span style={{ color: COLOR_TIPO_ALQUILER.temporada.swatch }}>T {kpisMes.porTipoHoy.temporada}</span>
              <span style={{ color: COLOR_TIPO_ALQUILER.periodo.swatch }}>P {kpisMes.porTipoHoy.periodo}</span>
              <span className="text-ink-2">D {kpisMes.porTipoHoy.dia}</span>
            </p>
          </div>
        </div>
      )}

      {vista === 'semana' ? (
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="flex border-b border-line sticky top-0 bg-card z-10">
                <div className="text-label w-36 shrink-0 px-4 py-3 text-ink-2">Unidad</div>
                <div className="flex-1 relative h-9">
                  {marcas.map((m) => (
                    <div
                      key={m.dia}
                      className="absolute top-0 h-full border-l border-line pl-2 text-label text-ink-2 font-semibold flex items-center"
                      style={{ left: `${m.left}%` }}
                    >
                      {formatFecha(m.dia).slice(0, 5)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fila de % de ocupación por día, arriba de las filas de unidad. */}
              <div className="flex border-b border-line bg-surface">
                <div className="text-label w-36 shrink-0 px-4 py-2 text-ink-2">% ocupación</div>
                <div className="flex-1 relative h-6">
                  {marcas.map((m) => {
                    const ocupadasDia = unidadesFiltradas.filter((u) =>
                      (barrasPorUnidad[u.id] || []).some((b) => reservaActiva(b.reserva) && m.left >= b.left && m.left < b.left + b.width),
                    ).length
                    const pct = Math.round((ocupadasDia / totalUnidadesFiltradas) * 100)
                    return (
                      <div key={m.dia} className="absolute top-0 h-full flex items-center text-label font-semibold text-ink-2" style={{ left: `${m.left}%` }}>
                        <span className="pl-2">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="divide-y divide-divider">
                {unidadesFiltradas.map((u) => {
                  const barras = barrasPorUnidad[u.id] || []
                  return (
                    <div key={u.id} className="flex items-stretch hover:bg-surface transition-all">
                      <div className="text-label w-36 shrink-0 px-4 py-3 flex items-center gap-2 text-ink-2">
                        <UnidadLabel tipo={u.tipo} numero={u.numero} />
                      </div>
                      <div className="flex-1 relative h-9 my-auto">
                        {marcas.map((m) => (
                          <div key={m.dia} className="absolute top-0 h-full border-l border-line" style={{ left: `${m.left}%` }} />
                        ))}
                        {hoyOffsetSemana !== null && (
                          <div className="absolute top-0 h-full border-l-2 border-gold-300 z-10" style={{ left: `${hoyOffsetSemana}%` }} />
                        )}
                        {barras.map((b, i) => (
                          <button
                            key={`${b.reserva.id}-${i}`}
                            type="button"
                            onClick={() => setReservaDetalle(b.reserva)}
                            title={`${formatNombre(b.reserva.clientes?.nombre) || 'S/N'} — ${formatFecha(b.reserva.fecha_inicio || b.reserva.fecha)} a ${formatFecha(b.reserva.fecha_fin || b.reserva.fecha)}`}
                            className={`absolute top-1.5 h-6 border text-label font-semibold truncate px-2 flex items-center gap-1 transition-all hover:brightness-110 ${b.color} ${
                              b.pendienteConfirmacion ? 'border-dashed border-2' : ''
                            } ${b.recortadaIzq ? 'rounded-l-none' : 'rounded-l-swatch'} ${b.recortadaDer ? 'rounded-r-none' : 'rounded-r-swatch'}`}
                            style={{ left: `${b.left}%`, width: `${b.width}%`, minWidth: 6 }}
                          >
                            {b.bonificada && <span className="w-1.5 h-1.5 rounded-full bg-ink-2 shrink-0" />}
                            {b.width > 6 && (b.reserva.clientes?.nombre || 'S/N')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {unidadesFiltradas.length === 0 && (
                  <div className="text-label px-8 py-10 text-center text-ink-2">Sin unidades para este filtro.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-surface card-pad ">
          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-label text-center text-ink-2">{d}</div>
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
                  className={`aspect-square rounded-inner border p-2 flex flex-col items-center justify-between text-center transition-all hover:border-gold-300 ${
                    esHoy ? 'border-gold bg-gold-100' : 'border-line bg-surface'
                  }`}
                  title={`${formatFecha(d)} — ${pct}% ocupado`}
                >
                  <span className={`text-label font-semibold ${esHoy ? 'text-ink' : 'text-ink-2'}`}>{Number(d.slice(-2))}</span>
                  <span className="text-label font-semibold text-ink">{pct}%</span>
                  <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-surface">
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

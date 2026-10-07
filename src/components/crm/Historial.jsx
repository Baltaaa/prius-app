import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays, Wallet, Users, MapPin, Receipt, Ban, StickyNote, Activity, History, Lock, Inbox, UserPlus,
} from 'lucide-react'
import { useHistorial } from '../../hooks/useHistorial'
import { formatFecha, formatFechaLarga, formatHora, formatPesos } from '../../lib/format'
import { linkToCliente, linkToReserva } from '../../lib/deepLinks'
import DateInput from '../inputs/DateInput'
import SearchInput from '../inputs/SearchInput'
import BrandSelect from '../ui/BrandSelect'

// Historial unificado (ítem 2, oct 2026; ampliado Tarea 4 oct 2026con
// actor/cliente y más tablas): un solo componente para el Historial global
// (Actividad.jsx), la temporada de una unidad (UnidadPreviewModal) y la
// ficha de un cliente/reserva. Lee de la tabla `eventos` (ver
// useHistorial.js) — global pagina de a 20 con filtros, el resto contra la
// RPC historial_entidad.
const TIPO_EVENTO_META = {
  reserva_alta: { icon: CalendarDays, label: 'Reserva nueva', color: 'text-[#FDE047]', filtro: 'reservas' },
  reserva_editada: { icon: CalendarDays, label: 'Reserva editada', color: 'text-[#FDE047]', filtro: 'reservas' },
  reserva_cancelada: { icon: Ban, label: 'Reserva cancelada', color: 'text-red-400', filtro: 'reservas' },
  reserva_eliminada: { icon: Ban, label: 'Reserva eliminada', color: 'text-red-400', filtro: 'reservas' },
  cambio_unidad: { icon: MapPin, label: 'Cambio de unidad', color: 'text-purple-400', filtro: 'cambios_unidad' },
  nota: { icon: StickyNote, label: 'Nota', color: 'text-sky-400', filtro: 'notas' },
  pago: { icon: Wallet, label: 'Pago registrado', color: 'text-green-400', filtro: 'pagos' },
  pago_editado: { icon: Wallet, label: 'Pago editado', color: 'text-green-400', filtro: 'pagos' },
  pago_eliminado: { icon: Wallet, label: 'Pago eliminado', color: 'text-red-400', filtro: 'pagos' },
  anulacion: { icon: Ban, label: 'Anulación', color: 'text-red-400', filtro: 'anulaciones' },
  gasto_anulado: { icon: Ban, label: 'Gasto anulado', color: 'text-red-400', filtro: 'anulaciones' },
  comprobante: { icon: Receipt, label: 'Comprobante cargado', color: 'text-amber-400', filtro: 'comprobantes' },
  comprobante_editado: { icon: Receipt, label: 'Comprobante editado', color: 'text-amber-400', filtro: 'comprobantes' },
  comprobante_eliminado: { icon: Receipt, label: 'Comprobante eliminado', color: 'text-red-400', filtro: 'comprobantes' },
  cliente_alta: { icon: Users, label: 'Cliente nuevo', color: 'text-sky-400', filtro: 'otros' },
  cliente_editado: { icon: Users, label: 'Cliente editado', color: 'text-sky-400', filtro: 'otros' },
  cliente_eliminado: { icon: Users, label: 'Cliente eliminado', color: 'text-red-400', filtro: 'otros' },
  unidad_estado: { icon: MapPin, label: 'Unidad', color: 'text-purple-400', filtro: 'otros' },
  gasto: { icon: Receipt, label: 'Gasto registrado', color: 'text-red-400', filtro: 'otros' },
  gasto_editado: { icon: Receipt, label: 'Gasto editado', color: 'text-red-400', filtro: 'otros' },
  // Tarea 4 (oct 2026): tablas nuevas cubiertas por el trigger.
  co_socio_agregado: { icon: UserPlus, label: 'Co-socio agregado', color: 'text-sky-400', filtro: 'otros' },
  co_socio_quitado: { icon: UserPlus, label: 'Co-socio quitado', color: 'text-red-400', filtro: 'otros' },
  caja_apertura: { icon: Lock, label: 'Caja abierta', color: 'text-green-400', filtro: 'caja' },
  caja_cierre: { icon: Lock, label: 'Caja cerrada', color: 'text-amber-400', filtro: 'caja' },
  caja_reapertura: { icon: Lock, label: 'Caja reabierta', color: 'text-red-400', filtro: 'caja' },
  caja_editada: { icon: Lock, label: 'Caja editada', color: 'text-gray-400', filtro: 'caja' },
  lead_nuevo: { icon: Inbox, label: 'Lead nuevo', color: 'text-orange-400', filtro: 'otros' },
  lead_editado: { icon: Inbox, label: 'Lead editado', color: 'text-orange-400', filtro: 'otros' },
  temporada_insert: { icon: CalendarDays, label: 'Temporada nueva', color: 'text-[#FDE047]', filtro: 'otros' },
  temporada_update: { icon: CalendarDays, label: 'Temporada editada', color: 'text-[#FDE047]', filtro: 'otros' },
  temporada_delete: { icon: CalendarDays, label: 'Temporada eliminada', color: 'text-red-400', filtro: 'otros' },
  migracion_historica: { icon: History, label: 'Migración histórica', color: 'text-gray-500', filtro: 'otros' },
}

const FILTROS = [
  { key: 'todos', label: 'Todo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'comprobantes', label: 'Comprobantes' },
  { key: 'cambios_unidad', label: 'Cambios de unidad' },
  { key: 'caja', label: 'Caja' },
  { key: 'anulaciones', label: 'Anulaciones' },
  { key: 'notas', label: 'Notas' },
]

const todayStr = () => new Date().toISOString().split('T')[0]
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

const TIPOS_MODIFICACION = ['reserva_editada', 'pago_editado', 'comprobante_editado', 'cambio_unidad', 'caja_editada']
const TIPOS_CANCELACION = ['reserva_cancelada', 'reserva_eliminada', 'anulacion', 'gasto_anulado', 'pago_eliminado', 'comprobante_eliminado', 'cliente_eliminado']

function etiquetaFecha(fecha) {
  if (fecha === todayStr()) return 'Hoy'
  if (fecha === addDays(todayStr(), -1)) return 'Ayer'
  return formatFechaLarga(fecha)
}

function metaDe(evento) {
  return TIPO_EVENTO_META[evento.tipo_evento] || { icon: Activity, label: evento.descripcion, color: 'text-gray-400', filtro: 'otros' }
}

// Campos cuyo cambio vale la pena mostrar como "antes → después" (Tarea 4)
// — el resto de los campos de `datos.before/after` son ruido para Mado.
const CAMPOS_DIFF = {
  reservas: [
    { campo: 'fecha_inicio', label: 'Fecha inicio', fmt: formatFecha },
    { campo: 'fecha_fin', label: 'Fecha fin', fmt: formatFecha },
    { campo: 'fecha', label: 'Fecha', fmt: formatFecha },
    { campo: 'valor_total', label: 'Monto', fmt: formatPesos },
    { campo: 'unidad_id', label: 'Unidad' },
  ],
  pagos: [{ campo: 'monto', label: 'Monto', fmt: formatPesos }, { campo: 'medio', label: 'Medio' }],
}

function diffTexto(evento) {
  const campos = CAMPOS_DIFF[evento.tabla]
  if (!campos) return null
  const before = evento.datos?.before
  const after = evento.datos?.after
  if (!before || !after) return null
  const cambios = []
  for (const { campo, label, fmt } of campos) {
    const a = before[campo]
    const b = after[campo]
    if (a === b || a == null || b == null) continue
    const fa = fmt ? fmt(a) : a
    const fb = fmt ? fmt(b) : b
    if (fa === fb) continue
    cambios.push(`${label}: ${fa} → ${fb}`)
  }
  return cambios.length ? cambios.join(' · ') : null
}

// tipo: 'global' | 'cliente' | 'reserva' | 'unidad'; id: uuid de la entidad
// (ignorado en 'global'). onEventoClick(evento) es opcional — si no se pasa,
// el evento se muestra pero no navega a ningún lado.
export default function Historial({ tipo = 'global', id, onEventoClick, compact = false }) {
  const [filtro, setFiltro] = useState('todos')
  const navigate = useNavigate()

  const mostrarFiltrosGlobales = tipo === 'global' && !compact
  const [searchParams, setSearchParams] = useSearchParams()
  const desde = mostrarFiltrosGlobales ? (searchParams.get('hDesde') || addDays(todayStr(), -7)) : null
  const hasta = mostrarFiltrosGlobales ? (searchParams.get('hHasta') || todayStr()) : null
  const q = mostrarFiltrosGlobales ? (searchParams.get('hq') || '') : ''
  const usuarioFiltro = mostrarFiltrosGlobales ? (searchParams.get('hUsuario') || '') : ''
  const setRango = (key, value, fallback) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    value === fallback ? next.delete(key) : next.set(key, value)
    return next
  }, { replace: true })

  const filtrosGlobal = mostrarFiltrosGlobales ? { desde, hasta, q, usuario: usuarioFiltro || undefined } : undefined
  const { items: todos, loading, hasMore, loadMore } = useHistorial(tipo, id, null, filtrosGlobal)

  const kpis = useMemo(() => {
    if (!mostrarFiltrosGlobales) return null
    let movimientos = 0
    let cobrado = 0
    let reservasNuevas = 0
    let modificaciones = 0
    let cancelaciones = 0
    for (const e of todos) {
      movimientos++
      if (e.tipo_evento === 'pago') cobrado += Number(e.datos?.after?.monto || 0)
      if (e.tipo_evento === 'reserva_alta') reservasNuevas++
      if (TIPOS_MODIFICACION.includes(e.tipo_evento)) modificaciones++
      if (TIPOS_CANCELACION.includes(e.tipo_evento)) cancelaciones++
    }
    return { movimientos, cobrado, reservasNuevas, modificaciones, cancelaciones }
  }, [todos, mostrarFiltrosGlobales])

  // Usuarios distintos vistos en la página actual, para el filtro — no es
  // un combobox contra toda la tabla (no hay un endpoint de usuarios acá),
  // pero alcanza para filtrar por quién aparece en lo ya cargado.
  const opcionesUsuario = useMemo(() => {
    const vistos = new Map()
    for (const e of todos) {
      if (e.usuario && e.actor_nombre) vistos.set(e.usuario, e.actor_nombre)
    }
    return [{ value: '', label: 'Todos los usuarios' }, ...[...vistos.entries()].map(([value, label]) => ({ value, label }))]
  }, [todos])

  const filtrados = useMemo(
    () => (filtro === 'todos' ? todos : todos.filter((e) => metaDe(e).filtro === filtro)),
    [todos, filtro],
  )

  const grupos = useMemo(() => {
    const map = new Map()
    for (const e of filtrados) {
      const key = e.fecha_ref || 'sin-fecha'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    const entries = [...map.entries()]
    const conFecha = entries.filter(([k]) => k !== 'sin-fecha').sort((a, b) => (a[0] < b[0] ? 1 : -1))
    const sinFecha = entries.filter(([k]) => k === 'sin-fecha')
    return [...conFecha, ...sinFecha]
  }, [filtrados])

  const handleClick = (evento) => {
    if (onEventoClick) return onEventoClick(evento)
    const after = evento.datos?.after || {}
    const before = evento.datos?.before || {}
    const clienteId = evento.cliente_id || after.cliente_id || before.cliente_id
    if (evento.tabla === 'reservas') return navigate(linkToReserva(evento.registro_id))
    if (evento.tabla === 'clientes') return navigate(linkToCliente(evento.registro_id))
    if (evento.tabla === 'pagos' && clienteId) {
      return navigate(linkToCliente(clienteId, { pagoId: evento.registro_id }))
    }
    if (evento.tabla === 'comprobantes' && clienteId) {
      return navigate(linkToCliente(clienteId))
    }
    if (clienteId) return navigate(linkToCliente(clienteId))
  }

  if (loading && todos.length === 0) {
    return <p className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">Cargando historial...</p>
  }

  return (
    <div className="space-y-6">
      {mostrarFiltrosGlobales && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <DateInput value={desde} onChange={(v) => setRango('hDesde', v || addDays(todayStr(), -7), addDays(todayStr(), -7))} className="w-40" />
            <span className="text-gray-600 text-xs">→</span>
            <DateInput value={hasta} onChange={(v) => setRango('hHasta', v || todayStr(), todayStr())} min={desde} className="w-40" />
            <BrandSelect value={usuarioFiltro} onChange={(v) => setRango('hUsuario', v, '')} options={opcionesUsuario} className="w-48" />
            <SearchInput value={q} onChange={(v) => setRango('hq', v, '')} placeholder="Buscar en el historial..." className="flex-1 min-w-[160px]" />
          </div>

          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="glass-card rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Movimientos</p>
                <p className="text-xl font-bold text-white mt-1">{kpis.movimientos}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cobrado</p>
                <p className="text-xl font-bold text-green-400 mt-1">{formatPesos(kpis.cobrado)}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Reservas nuevas</p>
                <p className="text-xl font-bold text-[#FDE047] mt-1">{kpis.reservasNuevas}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Modificaciones</p>
                <p className="text-xl font-bold text-white mt-1">{kpis.modificaciones}</p>
              </div>
              <div className="glass-card rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cancelaciones</p>
                <p className="text-xl font-bold text-red-400 mt-1">{kpis.cancelaciones}</p>
              </div>
            </div>
          )}
        </>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all min-h-[36px] ${
                filtro === f.key ? 'bg-[#FDE047] text-black border-[#FDE047]' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-gray-600 uppercase text-xs tracking-widest flex flex-col items-center gap-3">
          <History size={24} className="opacity-40" />
          Sin eventos todavía
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([fecha, items]) => (
            <div key={fecha}>
              <h3 className={`text-[11px] font-bold uppercase tracking-[0.2em] text-[#FDE047] mb-3 capitalize ${mostrarFiltrosGlobales ? 'sticky top-0 bg-[#0a0d14] py-2 z-10' : ''}`}>
                {fecha === 'sin-fecha' ? 'Sin fecha' : etiquetaFecha(fecha)}
              </h3>
              <div className="glass-card rounded-2xl glass-card-inner divide-y divide-white/5">
                {items.map((e) => {
                  const meta = metaDe(e)
                  const Icon = meta.icon
                  const esHistorico = e.datos?.after?.es_historico || e.datos?.before?.es_historico
                  const clienteId = e.cliente_id || e.datos?.after?.cliente_id || e.datos?.before?.cliente_id
                  const clickable = !!onEventoClick || e.tabla === 'reservas' || e.tabla === 'clientes' || !!clienteId
                  const Tag = clickable ? 'button' : 'div'
                  const diff = diffTexto(e)
                  // "Marcelo Madotta registró pago de $85.000 de Alejandro
                  // Carballo" (Tarea 4): actor + descripción + cliente, acá
                  // actor/cliente son snapshot (eventos.actor_nombre/
                  // cliente_nombre), no un join — siguen legibles aunque
                  // después se borre/renombre el registro real.
                  const actor = e.actor_nombre || 'Sistema'
                  return (
                    <Tag
                      key={e.id}
                      type={clickable ? 'button' : undefined}
                      onClick={clickable ? () => handleClick(e) : undefined}
                      className={`w-full flex items-start gap-4 px-4 py-3 text-left ${clickable ? 'hover:bg-white/5 transition-all' : ''}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${meta.color}`}><Icon size={16} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-200 flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{actor}</span> {e.descripcion}
                          {e.cliente_nombre && <span className="text-gray-400">· {e.cliente_nombre}</span>}
                          {esHistorico && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                              Histórico
                            </span>
                          )}
                        </p>
                        {diff && <p className="text-xs text-cyan-300 mt-1">{diff}</p>}
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mt-1">
                          {meta.label} · {formatHora(e.ts)}
                        </p>
                      </div>
                    </Tag>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-all"
        >
          {loading ? 'Cargando...' : 'Cargar más'}
        </button>
      )}
    </div>
  )
}

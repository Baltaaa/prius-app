import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Wallet, Users, MapPin, Receipt, Ban, StickyNote, Activity, History,
} from 'lucide-react'
import { useData } from '../../context/DataProvider'
import { useHistorial } from '../../hooks/useHistorial'
import { formatFechaLarga, formatHora } from '../../lib/format'

// Historial unificado (ítem 2, oct 2026): un solo componente para la Línea
// de tiempo global (Actividad.jsx), la temporada de una unidad
// (UnidadPreviewModal) y la ficha de un cliente/reserva — antes cada
// pantalla armaba su propia versión. Lee de la tabla `eventos` (ver
// useHistorial.js): tipo='global' usa la que ya está viva en DataProvider,
// el resto pagina contra la RPC historial_entidad.
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
}

const FILTROS = [
  { key: 'todos', label: 'Todo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'comprobantes', label: 'Comprobantes' },
  { key: 'cambios_unidad', label: 'Cambios de unidad' },
  { key: 'anulaciones', label: 'Anulaciones' },
  { key: 'notas', label: 'Notas' },
]

function metaDe(evento) {
  return TIPO_EVENTO_META[evento.tipo_evento] || { icon: Activity, label: evento.descripcion, color: 'text-gray-400', filtro: 'otros' }
}

// tipo: 'global' | 'cliente' | 'reserva' | 'unidad'; id: uuid de la entidad
// (ignorado en 'global'). onEventoClick(evento) es opcional — si no se pasa,
// el evento se muestra pero no navega a ningún lado.
export default function Historial({ tipo = 'global', id, onEventoClick, compact = false }) {
  const [filtro, setFiltro] = useState('todos')
  const navigate = useNavigate()
  const { eventos: eventosGlobales, loading: loadingGlobal } = useData()
  const { items: itemsEntidad, loading: loadingEntidad, hasMore, loadMore } = useHistorial(tipo, id)

  const todos = tipo === 'global' ? eventosGlobales : itemsEntidad
  const loading = tipo === 'global' ? loadingGlobal : loadingEntidad

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
    const clienteId = after.cliente_id || before.cliente_id
    if (evento.tabla === 'reservas') return navigate(`/app/reservas?id=${evento.registro_id}`)
    if (evento.tabla === 'clientes') return navigate(`/app/clientes?id=${evento.registro_id}`)
    if ((evento.tabla === 'pagos' || evento.tabla === 'comprobantes') && clienteId) {
      return navigate(`/app/clientes?id=${clienteId}`)
    }
  }

  if (loading && todos.length === 0) {
    return <p className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">Cargando historial...</p>
  }

  return (
    <div className="space-y-6">
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
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FDE047] mb-3 capitalize">
                {fecha === 'sin-fecha' ? 'Sin fecha' : formatFechaLarga(fecha)}
              </h3>
              <div className="glass-card rounded-2xl glass-card-inner divide-y divide-white/5">
                {items.map((e) => {
                  const meta = metaDe(e)
                  const Icon = meta.icon
                  const esHistorico = e.datos?.after?.es_historico || e.datos?.before?.es_historico
                  const clickable = !!onEventoClick || e.tabla === 'reservas' || e.tabla === 'clientes' || e.datos?.after?.cliente_id || e.datos?.before?.cliente_id
                  const Tag = clickable ? 'button' : 'div'
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
                          {e.descripcion}
                          {esHistorico && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                              Histórico
                            </span>
                          )}
                        </p>
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

      {tipo !== 'global' && hasMore && (
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

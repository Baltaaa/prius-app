import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { formatTiempoRelativo } from '../../lib/format'
import {
  Bell, Inbox, FileText, AlertCircle, Wallet, Clock, CalendarPlus,
  CalendarClock, Ban, CheckCircle2, CheckCheck, ChevronDown,
} from 'lucide-react'

// Catálogo único de tipo -> ícono/color/acción/plural (colapso). Si aparece
// un tipo sin entrada acá, cae a un ícono genérico — nunca se inventa un
// tipo nuevo fuera del catálogo del PASO 2.
const TIPO_META = {
  lead_nuevo: { icon: Inbox, color: 'text-orange-400', accion: 'Contactar lead', plural: 'leads nuevos' },
  comprobante_sin_vincular: { icon: FileText, color: 'text-violet-400', accion: 'Vincular comprobante', plural: 'comprobantes sin vincular' },
  pago_sin_monto: { icon: AlertCircle, color: 'text-prius-error', accion: 'Cargar recibos', plural: 'reservas con recibos sin monto' },
  reserva_sin_precio: { icon: AlertCircle, color: 'text-amber-400', accion: 'Asignar precio', plural: 'reservas sin precio' },
  caja_sin_cerrar: { icon: Wallet, color: 'text-amber-400', accion: 'Cerrar caja', plural: 'cajas sin cerrar' },
  saldo_pendiente_checkin: { icon: Clock, color: 'text-prius-error', accion: 'Ver reserva', plural: 'saldos pendientes' },
  reserva_creada: { icon: CalendarPlus, color: 'text-gold', accion: 'Ver reserva', plural: 'reservas creadas' },
  reserva_modificada: { icon: CalendarClock, color: 'text-gold', accion: 'Ver reserva', plural: 'reservas modificadas' },
  reserva_cancelada: { icon: Ban, color: 'text-prius-error', accion: 'Ver reserva', plural: 'reservas canceladas' },
  pago_registrado: { icon: CheckCircle2, color: 'text-prius-success', accion: 'Ver pago', plural: 'pagos registrados' },
  caja_cerrada: { icon: Wallet, color: 'text-prius-success', accion: 'Ver caja', plural: 'cajas cerradas' },
}

const metaDe = (tipo) => TIPO_META[tipo] || { icon: Bell, color: 'text-prius-slate', accion: null, plural: 'notificaciones' }

const TZ = 'America/Argentina/Buenos_Aires'
const diaFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const aDiaStr = (d) => diaFmt.format(new Date(d))

// Hoy / Ayer / Esta semana / Más antiguas — agrupación visual pedida en el
// PASO 4. "Esta semana" son los últimos 7 días excluyendo hoy/ayer.
function bucketDia(creadaAt) {
  const hoy = aDiaStr(Date.now())
  const ayer = aDiaStr(Date.now() - 24 * 3600 * 1000)
  const d = aDiaStr(creadaAt)
  if (d === hoy) return 'Hoy'
  if (d === ayer) return 'Ayer'
  const diffDias = Math.round((new Date(hoy) - new Date(d)) / 86400000)
  if (diffDias <= 7) return 'Esta semana'
  return 'Más antiguas'
}
const ORDEN_BUCKETS = ['Hoy', 'Ayer', 'Esta semana', 'Más antiguas']

// Agrupa por día y, dentro de cada día, colapsa ítems consecutivos con la
// misma clave_agrupacion (ej. "3 pagos registrados" expandible) — los que
// no tienen clave_agrupacion quedan sueltos.
function agruparPorDia(items) {
  const porDia = {}
  for (const item of items) {
    const b = bucketDia(item.creada_at)
    if (!porDia[b]) porDia[b] = []
    porDia[b].push(item)
  }
  const resultado = []
  for (const bucket of ORDEN_BUCKETS) {
    const lista = porDia[bucket]
    if (!lista || lista.length === 0) continue
    const grupos = []
    const vistos = new Set()
    for (const item of lista) {
      if (vistos.has(item.id)) continue
      if (item.clave_agrupacion) {
        const hermanos = lista.filter((x) => x.clave_agrupacion === item.clave_agrupacion)
        hermanos.forEach((h) => vistos.add(h.id))
        if (hermanos.length > 1) {
          grupos.push({ tipo: 'grupo', clave: item.clave_agrupacion, tipoNotif: item.tipo, items: hermanos })
          continue
        }
      }
      vistos.add(item.id)
      grupos.push({ tipo: 'item', item })
    }
    resultado.push({ bucket, grupos })
  }
  return resultado
}

function ItemNotificacion({ item, onAccion }) {
  const meta = metaDe(item.tipo)
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={() => onAccion(item)}
      className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-prius-subtle transition-all group"
    >
      <div className={`w-9 h-9 rounded-full bg-prius-subtle border border-hairline flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-black leading-snug">{item.titulo}</p>
        {item.detalle && <p className="text-[11px] text-prius-slate mt-0.5 truncate">{item.detalle}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-prius-muted">{formatTiempoRelativo(item.creada_at)}</span>
          {meta.accion && (
            <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
              {meta.accion}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function GrupoColapsado({ grupo, onAccion }) {
  const [abierto, setAbierto] = useState(false)
  const meta = metaDe(grupo.tipoNotif)
  const Icon = meta.icon
  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-prius-subtle transition-all"
      >
        <div className={`w-9 h-9 rounded-full bg-prius-subtle border border-hairline flex items-center justify-center shrink-0 ${meta.color}`}>
          <Icon size={16} />
        </div>
        <span className="flex-1 text-left text-xs font-bold text-black">
          {grupo.items.length} {meta.plural}
        </span>
        <ChevronDown size={14} className={`text-prius-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="pl-4 space-y-0.5">
          {grupo.items.map((item) => <ItemNotificacion key={item.id} item={item} onAccion={onAccion} />)}
        </div>
      )}
    </div>
  )
}

const SWIPE_THRESHOLD = 80

// Fila de novedad con swipe-to-archive (mobile) — pointer events, igual que
// el viejo Notificaciones.jsx. Solo se usa en la pestaña Novedades.
function FilaNovedad({ item, onAccion, onArchivar }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)

  const handleDown = (e) => { startX.current = e.clientX; setDragging(true) }
  const handleMove = (e) => { if (dragging) setDx(Math.min(0, e.clientX - startX.current)) }
  const handleUp = () => {
    setDragging(false)
    if (dx < -SWIPE_THRESHOLD) onArchivar(item.id)
    setDx(0)
  }

  return (
    <div
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => { setDragging(false); setDx(0) }}
      style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
      className={`touch-pan-y ${!item.leida_at ? 'bg-gold/[0.03]' : ''}`}
    >
      <ItemNotificacion item={item} onAccion={onAccion} />
    </div>
  )
}

/**
 * Contenido puro de la bandeja (sin chrome propio: el popover/sheet/página
 * que lo envuelve define ancho, alto y header). Dos pestañas, agrupación
 * por día, colapsado de similares — ver CLAUDE.md "Notificaciones".
 */
export default function NotificacionesBandeja({ onNavigate }) {
  const { loading, pendientes, novedades, countPendientes, countNovedadesNoLeidas, marcarNovedadesVistas, archivarNovedad, marcarTodoLeido } = useNotificaciones()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pendientes')
  const tabInicialDecidida = useRef(false)

  // "Pendientes" por default si hay alguna — pero recién se puede decidir
  // cuando terminó de cargar (antes de eso countPendientes siempre es 0).
  // Solo una vez: si el usuario después cambia de pestaña a mano, no se
  // pisa con este efecto.
  useEffect(() => {
    if (loading || tabInicialDecidida.current) return
    tabInicialDecidida.current = true
    setTab(countPendientes > 0 ? 'pendientes' : 'novedades')
  }, [loading, countPendientes])

  useEffect(() => {
    if (tab === 'novedades') marcarNovedadesVistas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleAccion = (item) => {
    navigate(item.ruta_destino)
    onNavigate?.()
  }

  const gruposPendientes = useMemo(() => agruparPorDia(pendientes), [pendientes])
  const gruposNovedades = useMemo(() => agruparPorDia(novedades), [novedades])

  if (loading) {
    return <p className="px-4 py-10 text-center text-xs text-prius-muted uppercase tracking-widest animate-pulse">Cargando...</p>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 pt-3 shrink-0">
        <button
          type="button"
          onClick={() => setTab('pendientes')}
          className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
            tab === 'pendientes' ? 'bg-gold text-black' : 'bg-prius-subtle text-prius-slate hover:text-black'
          }`}
        >
          Pendientes {countPendientes > 0 && `(${countPendientes})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('novedades')}
          className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
            tab === 'novedades' ? 'bg-gold text-black' : 'bg-prius-subtle text-prius-slate hover:text-black'
          }`}
        >
          Novedades {countNovedadesNoLeidas > 0 && `(${countNovedadesNoLeidas})`}
        </button>
      </div>

      {tab === 'novedades' && novedades.length > 0 && (
        <div className="flex justify-end px-3 pt-2 shrink-0">
          <button
            type="button"
            onClick={marcarTodoLeido}
            className="text-[10px] font-bold uppercase tracking-widest text-prius-slate hover:text-black transition-all flex items-center gap-1.5"
          >
            <CheckCheck size={12} /> Marcar todo como leído
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {tab === 'pendientes' ? (
          pendientes.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-prius-muted uppercase tracking-widest">Todo al día</p>
          ) : (
            gruposPendientes.map(({ bucket, grupos }) => (
              <div key={bucket} className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-prius-muted">{bucket}</p>
                {grupos.map((g) => g.tipo === 'grupo'
                  ? <GrupoColapsado key={g.clave} grupo={g} onAccion={handleAccion} />
                  : <ItemNotificacion key={g.item.id} item={g.item} onAccion={handleAccion} />)}
              </div>
            ))
          )
        ) : (
          novedades.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-prius-muted uppercase tracking-widest">Sin novedades</p>
          ) : (
            gruposNovedades.map(({ bucket, grupos }) => (
              <div key={bucket} className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-prius-muted">{bucket}</p>
                {grupos.map((g) => g.tipo === 'grupo'
                  ? <GrupoColapsado key={g.clave} grupo={g} onAccion={handleAccion} />
                  : <FilaNovedad key={g.item.id} item={g.item} onAccion={handleAccion} onArchivar={archivarNovedad} />)}
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}

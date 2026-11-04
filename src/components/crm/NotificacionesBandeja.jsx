import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { formatTiempoRelativo } from '../../lib/format'
import {
  Bell, Inbox, FileText, AlertCircle, Wallet, Clock, CalendarPlus,
  CalendarClock, Ban, CheckCircle2, CheckCheck, ChevronDown,
} from 'lucide-react'
import { emojiEnTexto } from '../../lib/unidadIcono'

// Catálogo único de tipo -> ícono/color/acción/plural (colapso). Si aparece
// un tipo sin entrada acá, cae a un ícono genérico — nunca se inventa un
// tipo nuevo fuera del catálogo del PASO 2.
const TIPO_META = {
  lead_nuevo: { icon: Inbox, color: 'text-ink', accion: 'Contactar lead', plural: 'leads nuevos' },
  comprobante_sin_vincular: { icon: FileText, color: 'text-ink-2', accion: 'Vincular comprobante', plural: 'comprobantes sin vincular' },
  pago_sin_monto: { icon: AlertCircle, color: 'text-danger', accion: 'Cargar recibos', plural: 'reservas con recibos sin monto' },
  reserva_sin_precio: { icon: AlertCircle, color: 'text-ink', accion: 'Asignar precio', plural: 'reservas sin precio' },
  caja_sin_cerrar: { icon: Wallet, color: 'text-ink', accion: 'Cerrar caja', plural: 'cajas sin cerrar' },
  saldo_pendiente_checkin: { icon: Clock, color: 'text-danger', accion: 'Ver reserva', plural: 'saldos pendientes' },
  reserva_creada: { icon: CalendarPlus, color: 'text-ink', accion: 'Ver reserva', plural: 'reservas creadas' },
  reserva_modificada: { icon: CalendarClock, color: 'text-ink', accion: 'Ver reserva', plural: 'reservas modificadas' },
  reserva_cancelada: { icon: Ban, color: 'text-danger', accion: 'Ver reserva', plural: 'reservas canceladas' },
  pago_registrado: { icon: CheckCircle2, color: 'text-success-ink', accion: 'Ver pago', plural: 'pagos registrados' },
  caja_cerrada: { icon: Wallet, color: 'text-success-ink', accion: 'Ver caja', plural: 'cajas cerradas' },
}

const metaDe = (tipo) => TIPO_META[tipo] || { icon: Bell, color: 'text-ink-2', accion: null, plural: 'notificaciones' }

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
      className="w-full text-left flex items-start gap-3 p-3 rounded-inner hover:bg-surface transition-all group"
    >
      <div className={`w-9 h-9 rounded-full bg-surface border border-line flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-label font-semibold text-ink leading-snug whitespace-normal break-words">{emojiEnTexto(item.titulo)}</p>
        {item.detalle && <p className="text-label text-ink-2 mt-1 truncate">{emojiEnTexto(item.detalle)}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-label text-ink-2">{formatTiempoRelativo(item.creada_at)}</span>
          {meta.accion && (
            <span className={`text-label ${meta.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
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
    <div className="rounded-inner overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 p-3 rounded-inner hover:bg-surface transition-all"
      >
        <div className={`w-9 h-9 rounded-full bg-surface border border-line flex items-center justify-center shrink-0 ${meta.color}`}>
          <Icon size={16} />
        </div>
        <span className="flex-1 text-left text-label font-semibold text-ink whitespace-normal break-words">
          {grupo.items.length} {meta.plural}
        </span>
        <ChevronDown size={14} className={`text-ink-2 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="pl-4 space-y-1">
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
      className={`touch-pan-y ${!item.leida_at ? 'bg-gold-100' : ''}`}
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
    return <p className="text-label px-4 py-10 text-center text-ink-2 animate-pulse">Cargando...</p>
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="flex items-center gap-1 px-3 pt-3 shrink-0">
        <button
          type="button"
          onClick={() => setTab('pendientes')}
          className={`flex-1 px-3 py-2 rounded-full text-label transition-all ${
            tab === 'pendientes' ? 'bg-ink text-on-ink' : 'bg-surface text-ink-2 hover:text-ink'
          }`}
        >
          Pendientes {countPendientes > 0 && `(${countPendientes})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('novedades')}
          className={`flex-1 px-3 py-2 rounded-full text-label transition-all ${
            tab === 'novedades' ? 'bg-ink text-on-ink' : 'bg-surface text-ink-2 hover:text-ink'
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
            className="text-label text-ink-2 hover:text-ink transition-all flex items-center gap-2"
          >
            <CheckCheck size={12} /> Marcar todo como leído
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2 space-y-4">
        {tab === 'pendientes' ? (
          pendientes.length === 0 ? (
            <p className="text-label px-4 py-10 text-center text-ink-2">Todo al día</p>
          ) : (
            gruposPendientes.map(({ bucket, grupos }) => (
              <div key={bucket} className="space-y-1">
                <p className="text-label px-2 text-ink-2">{bucket}</p>
                {grupos.map((g) => g.tipo === 'grupo'
                  ? <GrupoColapsado key={g.clave} grupo={g} onAccion={handleAccion} />
                  : <ItemNotificacion key={g.item.id} item={g.item} onAccion={handleAccion} />)}
              </div>
            ))
          )
        ) : (
          novedades.length === 0 ? (
            <p className="text-label px-4 py-10 text-center text-ink-2">Sin novedades</p>
          ) : (
            gruposNovedades.map(({ bucket, grupos }) => (
              <div key={bucket} className="space-y-1">
                <p className="text-label px-2 text-ink-2">{bucket}</p>
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

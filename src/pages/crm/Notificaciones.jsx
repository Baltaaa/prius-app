import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { linkToCliente, linkToPlano } from '../../lib/deepLinks'
import { AlertCircle, Calendar, Wallet, Check, CheckCheck, Bell } from 'lucide-react'

const TIPO_META = {
  caja: { icon: Wallet, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', accion: 'Ir a Caja' },
  checkin: { icon: Calendar, color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20', accion: 'Ver en el Plano' },
  saldo: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', accion: 'Registrar pago' },
}

const SWIPE_THRESHOLD = 80

// Un ítem por notificación, con swipe-to-dismiss en mobile (pointer events:
// funciona igual con touch y mouse, no hace falta duplicar handlers). El
// gesto solo marca como leída — nada se borra, la notificación es un cálculo
// en vivo (useNotifications), no una fila que exista para borrar.
function NotificacionItem({ item, onAccion, onLeida }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const meta = TIPO_META[item.type] || { icon: Bell, color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10', accion: null }
  const Icon = meta.icon

  const handlePointerDown = (e) => {
    startX.current = e.clientX
    setDragging(true)
  }
  const handlePointerMove = (e) => {
    if (!dragging) return
    setDx(Math.min(0, e.clientX - startX.current))
  }
  const handlePointerUp = () => {
    setDragging(false)
    if (dx < -SWIPE_THRESHOLD) onLeida(item.id)
    setDx(0)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { setDragging(false); setDx(0) }}
      style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
      className={`relative flex items-start gap-4 p-4 rounded-xl border touch-pan-y ${item.leida ? 'opacity-50' : ''} ${meta.bg} ${meta.border}`}
    >
      <div className={`w-10 h-10 rounded-full ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0`}>
        <Icon className={meta.color} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white uppercase tracking-tight">{item.titulo}</p>
        <p className="text-xs text-gray-400 mt-0.5">{item.detalle}</p>
        <div className="flex items-center gap-4 mt-2">
          {meta.accion && (item.reservaId || item.type === 'caja') && (
            <button
              type="button"
              onClick={() => onAccion(item)}
              className={`text-[10px] font-bold uppercase tracking-widest ${meta.color} hover:opacity-80 transition-all`}
            >
              {meta.accion}
            </button>
          )}
          {!item.leida && (
            <button
              type="button"
              onClick={() => onLeida(item.id)}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all flex items-center gap-1"
            >
              <Check size={12} /> Marcar como leída
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, items, onAccion, onLeida }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FDE047]">{titulo} ({items.length})</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <NotificacionItem key={item.id} item={item} onAccion={onAccion} onLeida={onLeida} />
        ))}
      </div>
    </div>
  )
}

export default function Notificaciones() {
  const { urgentes, informativas, loading, marcarLeida, marcarTodas, count } = useNotifications()
  const navigate = useNavigate()

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Cargando notificaciones...</span></div>
  }

  // Destino correcto por tipo (Tarea 2, oct 2026): "saldo" va a Clientes con
  // esa reserva resaltada (ahí vive RegistrarPago, nunca desde Caja — ver
  // CLAUDE.md); "checkin" va al Plano del día con la unidad resaltada, no a
  // Reservas (la mayoría de las llegadas son de temporada, que ni siquiera
  // vive en esa pantalla).
  const handleAccion = (item) => {
    if (item.type === 'caja') return navigate('/app/caja')
    if (item.type === 'saldo' && item.clienteId) {
      return navigate(linkToCliente(item.clienteId, { reservaId: item.reservaId }))
    }
    if (item.type === 'checkin') {
      return navigate(linkToPlano(new Date().toISOString().split('T')[0], item.unidadId))
    }
  }

  const sinLeer = [...urgentes, ...informativas].filter((i) => !i.leida)

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-widest text-white">Notificaciones</h1>
        {sinLeer.length > 0 && (
          <button
            type="button"
            onClick={marcarTodas}
            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all flex items-center gap-1.5"
          >
            <CheckCheck size={14} /> Marcar todas como leídas
          </button>
        )}
      </div>

      {count === 0 && urgentes.length === 0 && informativas.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-gray-600 uppercase text-xs tracking-widest flex flex-col items-center gap-3">
          <Bell size={28} className="opacity-40" />
          Todo tranquilo por ahora — sin notificaciones.
        </div>
      ) : (
        <div className="space-y-10">
          <Seccion titulo="Urgentes" items={urgentes} onAccion={handleAccion} onLeida={marcarLeida} />
          <Seccion titulo="Informativas" items={informativas} onAccion={handleAccion} onLeida={marcarLeida} />
        </div>
      )}
    </div>
  )
}

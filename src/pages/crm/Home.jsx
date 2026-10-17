import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useCaja } from '../../hooks/useCaja'
import { useLeads } from '../../hooks/useLeads'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import { useHistorial } from '../../hooks/useHistorial'
import { useData } from '../../context/DataProvider'
import { useAuth, usePermiso } from '../../context/AuthProvider'
import { supabase } from '../../lib/supabase'
import { calcularPlanoStats } from '../../lib/planoStats'
import { buildUnitsMap } from '../../lib/planoUnits'
import { formatPesos, formatFechaLarga, formatHora } from '../../lib/format'
import { linkToPlano, linkToReserva, linkToCliente } from '../../lib/deepLinks'
import { isFeatureEnabled } from '../../lib/features'
import ClimaHero from '../../components/dashboard/ClimaHero'
import {
  Activity, Tent, Umbrella, DoorOpen, Layers, Hourglass, Wallet, AlertCircle,
  Lock, Unlock, TrendingUp, Inbox, Bell, Clock, QrCode, ArrowRight,
} from 'lucide-react'

const todayStr = () => new Date().toISOString().split('T')[0]

/** Tarjeta de KPI del Dashboard — número grande, label chico en mayúscula,
 * barra de progreso fina opcional. Clickeable cuando se pasa `onClick`
 * (lleva al módulo correspondiente, filtrado cuando aplica). Mismo lenguaje
 * visual que el resto de la app (card-light, acento #FDE047). */
function DashCard({ icon: Icon, label, value, sub, progress, accent, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card-light rounded-2xl p-4 text-left transition-all min-w-0 ${onClick ? 'hover:bg-white/[0.07] cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${accent ? 'border-gold/30 bg-gold/10' : 'border-hairline bg-prius-subtle'}`}>
          <Icon size={14} className={accent ? 'text-gold' : 'text-prius-slate'} />
        </div>
        <p className="text-[9px] font-bold text-prius-slate uppercase tracking-widest truncate">{label}</p>
      </div>
      <p className="text-2xl font-bold text-black tabular-nums leading-none truncate">{value}</p>
      {sub != null && <p className="text-[10px] text-prius-muted tabular-nums mt-1 truncate">{sub}</p>}
      {progress != null && (
        <div className="mt-2.5 h-[3px] rounded-full bg-prius-subtle overflow-hidden">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
        </div>
      )}
    </Tag>
  )
}

function SeccionTitulo({ children }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-prius-muted mb-3">{children}</h2>
}

export default function Home() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const puedeVerReportes = usePermiso('reportes_globales')
  const recepcionOn = isFeatureEnabled('recepcion')

  const { reservas, unidades, loading: resLoading } = useReservas()
  const { pagos, temporadas } = useData()
  const { cajaHoy, loading: cajaLoading } = useCaja()
  const { sinContactar: leadsSinContactar, loading: leadsLoading } = useLeads()
  const { countPendientes, countNovedadesNoLeidas } = useNotificaciones()
  const { items: historialItems, loading: historialLoading } = useHistorial('global', null, null, null)

  const hoy = useMemo(() => todayStr(), [])

  // Estado de caja con usuario — `caja_diaria.abierta_por/cerrada_por` son
  // uuid; no hay ningún hook que ya resuelva nombres de perfil (solo el
  // propio, vía useAuth). Un select liviano (4 filas) a `perfiles`, no una
  // tabla/trigger/RPC nueva — mismo criterio que cualquier lectura puntual.
  const [perfilesPorId, setPerfilesPorId] = useState({})
  useEffect(() => {
    let activo = true
    supabase.from('perfiles').select('user_id, nombre').then(({ data }) => {
      if (!activo || !data) return
      setPerfilesPorId(Object.fromEntries(data.map((p) => [p.user_id, p.nombre])))
    })
    return () => { activo = false }
  }, [])

  // Mismo cálculo exacto que usa el Plano para "hoy" (lib/planoUnits.js +
  // lib/planoStats.js) — nunca se reinventa el criterio de ocupación/mix.
  const units = useMemo(() => buildUnitsMap(unidades, reservas, hoy), [unidades, reservas, hoy])
  const stats = useMemo(
    () => calcularPlanoStats({ units, pagos, cajaDelDia: cajaHoy, selectedDate: hoy }),
    [units, pagos, cajaHoy, hoy],
  )

  // Llegadas de hoy: reservas (no canceladas) cuya fecha de inicio real es
  // hoy — temporada resuelve la fecha contra `temporadas` (no tiene fecha
  // propia), mismo criterio que ya usa el resto de la app (ver
  // CLAUDE.md "Historial"/notificaciones viejas).
  const temporadasPorId = useMemo(() => Object.fromEntries((temporadas || []).map((t) => [t.id, t])), [temporadas])
  const llegadasHoy = useMemo(() => reservas.filter((r) => {
    if (r.estado === 'cancelada') return false
    if (r.tipo_alquiler === 'dia') return r.fecha === hoy
    if (r.tipo_alquiler === 'periodo') return r.fecha_inicio === hoy
    if (r.tipo_alquiler === 'temporada') return temporadasPorId[r.temporada_id]?.fecha_inicio === hoy
    return false
  }), [reservas, hoy, temporadasPorId])

  // Facturación/deuda (mismo cálculo que Reportes.jsx, sin query nueva —
  // reusa `reservas` ya cargadas) — dato de dinero agregado de todo el CRM:
  // mismo gate de permiso que ya tiene la pantalla de Reportes.
  const { facturacionBruta, deudaExterna, totalCobrado } = useMemo(() => {
    let facturado = 0, pendiente = 0
    for (const r of reservas) {
      if (r.estado === 'cancelada' || r.bonificada) continue
      facturado += Number(r.valor_total) || 0
      pendiente += Number(r.saldo) || 0
    }
    return { facturacionBruta: facturado, deudaExterna: pendiente, totalCobrado: facturado - pendiente }
  }, [reservas])

  const ultimosMovimientos = (historialItems || []).slice(0, 5)

  const loading = resLoading || cajaLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-prius-muted animate-pulse uppercase tracking-widest">Sincronizando PriusAdmin...</span>
      </div>
    )
  }

  const nombreUsuario = perfil?.nombre || perfil?.usuario || 'Usuario'
  const primerNombre = nombreUsuario.split(' ')[0]

  return (
    <div className="space-y-8 animate-premium-fade">
      {/* Fila 1: saludo + clima */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-black">Hola, {primerNombre}</h1>
          <p className="text-xs text-prius-muted uppercase tracking-wider mt-1">{formatFechaLarga(hoy)}</p>
        </div>
        <ClimaHero fecha={hoy} />
      </div>

      {/* Fila 2: operación del día */}
      <div>
        <SeccionTitulo>Operación de hoy</SeccionTitulo>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <DashCard icon={Activity} label="Ocupación" value={`${Math.round(stats.ocupacion.pct * 100)}%`} sub={`${stats.ocupacion.count}/${stats.ocupacion.total} unidades`} progress={stats.ocupacion.pct} accent onClick={() => navigate(linkToPlano())} />
          <DashCard icon={Tent} label="Carpas" value={`${Math.round(stats.carpas.pct * 100)}%`} sub={`${stats.carpas.count}/${stats.carpas.total}`} progress={stats.carpas.pct} onClick={() => navigate(linkToPlano())} />
          <DashCard icon={Umbrella} label="Sombrillas" value={`${Math.round(stats.sombrillas.pct * 100)}%`} sub={`${stats.sombrillas.count}/${stats.sombrillas.total}`} progress={stats.sombrillas.pct} onClick={() => navigate(linkToPlano())} />
          <DashCard icon={DoorOpen} label="Libres hoy" value={stats.libres.count} onClick={() => navigate(linkToPlano())} />
          <DashCard icon={Layers} label="Mix T/P/D" value={`${stats.mix.temporada}/${stats.mix.periodo}/${stats.mix.dia}`} onClick={() => navigate(linkToPlano())} />
          <DashCard icon={Hourglass} label="Sin confirmar" value={stats.pendientes.sinVerificar ? `${stats.pendientes.count}+` : stats.pendientes.count} onClick={() => navigate(linkToPlano())} />
        </div>
      </div>

      {/* Fila 3: dinero y caja */}
      <div>
        <SeccionTitulo>Caja y dinero</SeccionTitulo>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashCard
            icon={cajaHoy ? Unlock : Lock}
            label="Caja"
            value={cajaHoy ? 'Abierta' : 'Sin iniciar'}
            sub={cajaHoy ? `Desde ${formatHora(cajaHoy.abierta_at)} · ${perfilesPorId[cajaHoy.abierta_por] || '—'}` : 'Tocá para abrirla'}
            accent={!!cajaHoy}
            onClick={() => navigate('/app/caja')}
          />
          <DashCard icon={Wallet} label="Ingresos del día" value={stats.ingresosDelDia != null ? formatPesos(stats.ingresosDelDia) : '—'} onClick={() => navigate('/app/caja')} />
          <DashCard
            icon={AlertCircle}
            label="Pendientes de cobro"
            value={stats.pendientes.count}
            sub={stats.pendientes.saldo > 0 ? formatPesos(stats.pendientes.saldo) : null}
            onClick={() => navigate('/app/reservas')}
          />
          {puedeVerReportes && (
            <DashCard icon={TrendingUp} label="Deuda externa" value={formatPesos(deudaExterna)} sub={`Cobrado ${formatPesos(totalCobrado)} de ${formatPesos(facturacionBruta)}`} onClick={() => navigate('/app/reportes')} />
          )}
        </div>
      </div>

      {/* Fila 4: actividad */}
      <div>
        <SeccionTitulo>Actividad</SeccionTitulo>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <DashCard icon={Inbox} label="Leads sin contactar" value={leadsLoading ? '—' : leadsSinContactar} onClick={() => navigate('/app/leads?estado=nuevo')} />
          <DashCard icon={Bell} label="Notificaciones" value={countPendientes + countNovedadesNoLeidas} sub={countPendientes > 0 ? `${countPendientes} pendientes` : 'Al día'} accent={countPendientes > 0} onClick={() => navigate('/app/notificaciones')} />
          {recepcionOn && (
            <DashCard icon={QrCode} label="Llegan hoy" value={llegadasHoy.length} onClick={() => navigate('/app/recepcion')} />
          )}
        </div>

        <div className="card-light rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-prius-slate flex items-center gap-2">
              <Clock size={13} /> Últimos movimientos
            </p>
            <button onClick={() => navigate('/app/historial')} className="text-[10px] font-bold uppercase tracking-widest text-gold hover:text-yellow-300 flex items-center gap-1">
              Ver todo <ArrowRight size={12} />
            </button>
          </div>
          {historialLoading ? (
            <p className="text-xs text-prius-muted uppercase tracking-widest animate-pulse py-4 text-center">Cargando...</p>
          ) : ultimosMovimientos.length === 0 ? (
            <p className="text-xs text-prius-muted py-4 text-center">Sin movimientos recientes.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {ultimosMovimientos.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    if (ev.tabla === 'reservas' && ev.registro_id) navigate(linkToReserva(ev.registro_id))
                    else if (ev.cliente_id) navigate(linkToCliente(ev.cliente_id))
                  }}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-prius-subtle rounded-lg px-2 -mx-2 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-black truncate">{ev.descripcion}</p>
                    <p className="text-[10px] text-prius-muted mt-0.5 truncate">
                      {ev.actor_nombre || 'Sistema'}{ev.cliente_nombre ? ` · ${ev.cliente_nombre}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-prius-muted tabular-nums shrink-0">{formatHora(ev.ts)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

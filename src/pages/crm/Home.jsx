import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useCaja } from '../../hooks/useCaja'
import { useLeads } from '../../hooks/useLeads'
import { useHistorial } from '../../hooks/useHistorial'
import { useData } from '../../context/DataProvider'
import { useAuth, usePermiso } from '../../context/AuthProvider'
import { supabase } from '../../lib/supabase'
import { calcularPlanoStats } from '../../lib/planoStats'
import { buildUnitsMap } from '../../lib/planoUnits'
import { formatPesos, formatFechaLarga, formatHora, formatMontosEnTexto, formatPorcentaje } from '../../lib/format'
import { linkToReserva, linkToCliente } from '../../lib/deepLinks'
import { isFeatureEnabled } from '../../lib/features'
import { useClima } from '../../hooks/useClima'
import { useInitialLoad, useTimeoutFallback } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'
import ClimaHero from '../../components/dashboard/ClimaHero'
import {
  BookmarkPlus, CreditCard, UserCheck2, UserSearch, Lock, Unlock, ArrowRight,
  AlertTriangle, LogIn, TimerOff, PenLine, QrCode, CircleCheck,
  Tent, Umbrella, Wallet,
} from 'lucide-react'

const todayStr = () => new Date().toISOString().split('T')[0]

// Fila chica de dato al pie de una card (Mix T/P/D, Sin confirmar) — label +
// valor, sin ícono, sin acento.
function MiniStat({ label, value }) {
  return (
    <div className="flex items-center justify-between text-body-sm">
      <span className="text-prius-slate">{label}</span>
      <span className="text-black font-semibold tabular-nums">{value}</span>
    </div>
  )
}

// Barra de progreso fina dorada/negra reutilizada en las cards de capacidad.
function Bar({ pct, tone = 'gold' }) {
  const fill = tone === 'success' ? 'bg-prius-success' : tone === 'black' ? 'bg-black' : 'bg-gold'
  return (
    <div className="w-full h-3 rounded-full bg-prius-surface overflow-hidden">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(100, Math.max(0, Math.round(pct * 100)))}%` }} />
    </div>
  )
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
  const { items: historialItems, loading: historialLoading } = useHistorial('global', null, null, null)

  const hoy = useMemo(() => todayStr(), [])

  // B2 (oct 2026): único `useClima` levantado acá (ver comentario en
  // ClimaHero.jsx) — con timeout de 4s porque es la única request externa
  // lenta de esta pantalla (Open-Meteo vía Edge Function); el resto son
  // queries propias de Supabase, sin timeout porque no cuelgan.
  const { clima, loading: climaLoadingRaw } = useClima(hoy)
  const climaLoading = useTimeoutFallback(climaLoadingRaw, 4000)

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
  // propia), mismo criterio que ya usa el resto de la app.
  const temporadasPorId = useMemo(() => Object.fromEntries((temporadas || []).map((t) => [t.id, t])), [temporadas])
  const llegadasHoy = useMemo(() => reservas.filter((r) => {
    if (r.estado === 'cancelada') return false
    if (r.tipo_alquiler === 'dia') return r.fecha === hoy
    if (r.tipo_alquiler === 'periodo') return r.fecha_inicio === hoy
    if (r.tipo_alquiler === 'temporada') return temporadasPorId[r.temporada_id]?.fecha_inicio === hoy
    return false
  }), [reservas, hoy, temporadasPorId])

  // Facturación/deuda (mismo cálculo que Reportes.jsx, sin query nueva —
  // reusa `reservas` ya cargadas). Dato agregado de dinero de todo el CRM:
  // mismo gate de permiso que ya tiene Reportes — solo el bloque "Total
  // recaudado / meta / % percibido" de la card de Cobranzas queda detrás de
  // `puedeVerReportes`; Pendientes de cobro e Ingresos del día ya eran
  // visibles para cualquier rol antes del rediseño, se mantiene así.
  const { facturacionBruta, deudaExterna, totalCobrado } = useMemo(() => {
    let facturado = 0, pendiente = 0
    for (const r of reservas) {
      if (r.estado === 'cancelada' || r.bonificada) continue
      facturado += Number(r.valor_total) || 0
      pendiente += Number(r.saldo) || 0
    }
    return { facturacionBruta: facturado, deudaExterna: pendiente, totalCobrado: facturado - pendiente }
  }, [reservas])
  const pctPercibido = facturacionBruta > 0 ? totalCobrado / facturacionBruta : 0

  // Tabs de "Últimos movimientos" (desktop): filtro client-side sobre los
  // mismos `historialItems` ya cargados por useHistorial — sin query nueva.
  const [tabMovimientos, setTabMovimientos] = useState('todos')
  const TABS_MOVIMIENTOS = [
    { key: 'todos', label: 'Todos' },
    { key: 'seguridad', label: 'Seguridad', tabla: 'auth' },
    { key: 'leads', label: 'Leads', tabla: 'leads' },
    { key: 'pagos', label: 'Pagos', tabla: 'pagos' },
  ]
  const movimientosFiltrados = useMemo(() => {
    const items = historialItems || []
    const tab = TABS_MOVIMIENTOS.find((t) => t.key === tabMovimientos)
    const filtrados = tab?.tabla ? items.filter((ev) => ev.tabla === tab.tabla) : items
    return filtrados.slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historialItems, tabMovimientos])

  // climaLoading YA tiene su propio timeout de 4s (arriba) — a los 4s deja
  // de bloquear la sección aunque Open-Meteo no haya contestado todavía;
  // ClimaHero cae sola a su estado "no disponible" (mismo tamaño de card).
  const loading = resLoading || cajaLoading || climaLoading
  const ready = useInitialLoad(loading)

  if (!ready) {
    return (
      <div className="space-y-6 lg:space-y-10 font-ui">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg">
          <Skeleton className="lg:col-span-7 h-[220px]" />
          <div className="lg:col-span-5 flex flex-col gap-gutter-lg">
            <Skeleton className="h-24" />
            <div className="grid grid-cols-3 gap-space-sm">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-20" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-lg">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const nombreUsuario = perfil?.nombre || perfil?.usuario || 'Usuario'
  const primerNombre = nombreUsuario.split(' ')[0]

  const iconoMovimiento = (ev) => {
    if (ev.tabla === 'auth' && ev.tipo_evento === 'login') return LogIn
    if (ev.tabla === 'auth') return TimerOff
    return PenLine
  }

  // --- Accesos rápidos: navegación a pantallas/modales que ya existen, sin
  // funcionalidad nueva (mock: Reservar/Cobrar/Check-in/Buscar cliente). ---
  const accesos = [
    { key: 'reservar', label: 'Reservar', sub: 'Nueva carpa o sombrilla', icon: BookmarkPlus, onClick: () => navigate('/app/reservas'), accent: true },
    { key: 'cobrar', label: 'Cobrar', sub: 'Recibos y saldos pendientes', icon: CreditCard, onClick: () => navigate('/app/caja') },
    { key: 'checkin', label: 'Check-in', sub: 'Ingreso de socios', icon: UserCheck2, onClick: () => navigate('/app/recepcion') },
    { key: 'buscar', label: 'Buscar cliente', sub: 'Legajos e historial', icon: UserSearch, onClick: () => navigate('/app/clientes') },
  ]

  return (
    <div className="flex flex-col gap-space-lg font-ui -mx-4 sm:-mx-6 md:-mx-8 lg:mx-0 px-4 sm:px-6 md:px-8 lg:px-0 animate-premium-fade">
      {/* Fila 0: saludo + estado + badges KPI (desktop) */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-prius-surface text-prius-success text-label-md uppercase">
              <span className="w-2 h-2 rounded-full bg-prius-success animate-pulse" />
              Guardia Sur · Activo
            </span>
            <span className="hidden lg:inline text-prius-slate text-body-sm">|</span>
            <span className="hidden lg:inline text-prius-slate text-body-sm">{formatFechaLarga(hoy)}</span>
          </div>
          <h1 className="text-headline-lg-mobile lg:text-display-lg text-black tracking-tight">Hola, {primerNombre}</h1>
          <p className="lg:hidden text-body-sm text-prius-slate mt-0.5">{formatFechaLarga(hoy)}</p>
          <p className="hidden lg:block text-body-md text-prius-slate mt-1">Gestión operativa de playa, cobranzas y accesos en tiempo real.</p>
        </div>

        {/* Badges KPI — solo desktop (mobile los muestra como chips más abajo) */}
        <div className="hidden lg:flex items-center gap-space-sm">
          <button onClick={() => navigate('/app/leads?estado=nuevo')} className="flex items-center gap-2 px-space-md py-2.5 rounded-xl card-light hover:bg-prius-subtle transition-colors text-left">
            <CircleCheck size={18} className="text-prius-success" />
            <div>
              <span className="block text-label-md text-prius-slate uppercase">Leads sin contactar</span>
              <span className="text-title-md text-black">{leadsLoading ? '—' : leadsSinContactar} al día</span>
            </div>
          </button>
        </div>
      </section>

      {/* Fila 1 desktop: clima (7/12) + accesos rápidos y caja (5/12). Mobile: clima primero, accesos después. */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg">
        <div className="lg:col-span-7 min-w-0">
          <ClimaHero fecha={hoy} clima={clima} loading={climaLoading} />
        </div>

        <div className="lg:col-span-5 min-w-0 flex flex-col gap-space-md order-first lg:order-none">
          {/* grid-cols-2 en mobile (pulido UX, oct 2026, item 8): antes era
              grid-cols-4 — "Buscar cliente" (el label más largo) se salía
              de su card en 375px. 2x2 da el doble de ancho por card; el
              label queda centrado y puede partirse en dos líneas prolijas
              (sin truncate: `break-words` + sin whitespace-nowrap) en vez
              de desbordar. */}
          <div className="grid grid-cols-2 gap-space-sm flex-1">
            {accesos.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                className="group flex flex-col items-center lg:items-start justify-center lg:justify-between gap-2 p-space-sm lg:p-space-md rounded-2xl card-light hover:bg-prius-subtle active:scale-95 transition-all text-center lg:text-left"
              >
                <div className={`w-12 h-12 lg:w-10 lg:h-10 rounded-full lg:rounded-xl flex items-center justify-center mb-1.5 lg:mb-0 transition-colors ${a.accent ? 'bg-gold' : 'bg-prius-surface group-hover:bg-gold/20'}`}>
                  <a.icon size={20} className="text-black" />
                </div>
                <div className="lg:mt-4 min-w-0 w-full">
                  <span className="block text-xs md:text-label-md lg:text-headline-sm text-black leading-tight break-words">{a.label}</span>
                  <span className="hidden lg:block text-body-sm text-prius-slate whitespace-normal">{a.sub}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Caja: estado + abrir */}
          <div className="p-space-md rounded-2xl card-light flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full lg:rounded-xl bg-prius-surface flex items-center justify-center shrink-0 text-prius-slate">
                {cajaHoy ? <Unlock size={18} /> : <Lock size={18} />}
              </div>
              <div className="truncate">
                <p className="text-title-md text-black truncate">{cajaHoy ? 'Caja abierta' : 'Caja sin iniciar'}</p>
                {/* B6 (oct 2026): si falta la hora o el usuario que la abrió,
                    se oculta la línea entera en vez de mostrar "—" — un
                    dato a medias no aporta nada acá. */}
                {cajaHoy && cajaHoy.abierta_at && perfilesPorId[cajaHoy.abierta_por] ? (
                  <p className="text-body-sm text-prius-slate truncate">
                    Desde {formatHora(cajaHoy.abierta_at)} · {perfilesPorId[cajaHoy.abierta_por]}
                  </p>
                ) : !cajaHoy ? (
                  <p className="text-body-sm text-prius-slate truncate">Turno no registrado aún</p>
                ) : null}
              </div>
            </div>
            {!cajaHoy && (
              <button onClick={() => navigate('/app/caja')} className="h-9 px-3 rounded-xl bg-black text-white text-label-lg shrink-0 active:scale-95 transition-transform flex items-center gap-1">
                Abrir <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Fila 2 mobile: chips de actividad en vivo (scroll horizontal) — en desktop ya están arriba como badges */}
      <section className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-none flex items-center gap-2">
        <button onClick={() => navigate('/app/leads?estado=nuevo')} className="flex items-center gap-2 px-3 py-2 rounded-xl card-light shrink-0">
          <span className="w-2 h-2 rounded-full bg-prius-slate" />
          <span className="text-body-sm text-prius-slate">Leads sin contactar:</span>
          <span className="text-title-md text-black">{leadsLoading ? '—' : leadsSinContactar}</span>
        </button>
        {recepcionOn && (
          <button onClick={() => navigate('/app/recepcion')} className="flex items-center gap-2 px-3 py-2 rounded-xl card-light shrink-0">
            <span className="w-2 h-2 rounded-full bg-prius-success" />
            <span className="text-body-sm text-prius-slate">Llegan hoy:</span>
            <span className="text-title-md text-black">{llegadasHoy.length}</span>
          </button>
        )}
      </section>

      {/* Fila 3: Capacidad diaria + Cobranzas temporada. `items-start` (B6,
          oct 2026): sin esto, CSS Grid estira las dos cards a la altura de
          la más alta por default — con `justify-between` adentro, esa
          altura de más se convertía en un hueco vacío entre el bloque de
          arriba y las sub-cards de abajo. Alto automático por card, sin
          estirar. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-lg items-start">
        {/* Capacidad diaria (antes "Operación de hoy") */}
        <div className="card-light rounded-2xl p-space-lg flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-label-md text-prius-slate uppercase">Capacidad Diaria</span>
              <button onClick={() => navigate('/app/plano')} className="px-2.5 py-1 rounded-full bg-prius-surface text-prius-success text-label-md">
                {stats.libres.count} disponibles para hoy
              </button>
            </div>
            <button onClick={() => navigate('/app/plano')} className="w-full mt-space-md flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between text-left whitespace-normal">
              <div className="min-w-0">
                <span className="block text-label-md text-prius-slate uppercase">Ocupación General</span>
                <span className="text-metric-xl text-black">{Math.round(stats.ocupacion.pct * 100)}%</span>
              </div>
              <div className="min-w-0 sm:text-right">
                <span className="text-title-md text-black">{stats.ocupacion.count} ocupadas</span>
                <span className="block text-body-sm text-prius-slate">de {stats.ocupacion.total} unidades totales</span>
              </div>
            </button>
            <div className="mt-3"><Bar pct={stats.ocupacion.pct} /></div>
          </div>

          <div className="grid grid-cols-2 gap-space-md mt-space-lg pt-space-md border-t border-hairline">
            <button onClick={() => navigate('/app/plano')} className="p-space-md rounded-xl bg-prius-surface text-left">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-title-md text-black"><Tent size={14} /> Carpas</span>
                <span className="text-label-md text-black font-semibold">{Math.round(stats.carpas.pct * 100)}%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-headline-sm text-black">{stats.carpas.count} <span className="text-body-sm font-normal text-prius-slate">/ {stats.carpas.total}</span></span>
              </div>
              <div className="mt-2"><Bar pct={stats.carpas.pct} tone="black" /></div>
            </button>
            <button onClick={() => navigate('/app/plano')} className="p-space-md rounded-xl bg-prius-surface text-left">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-title-md text-black"><Umbrella size={14} /> Sombrillas</span>
                <span className="text-label-md text-black font-semibold">{Math.round(stats.sombrillas.pct * 100)}%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-headline-sm text-black">{stats.sombrillas.count} <span className="text-body-sm font-normal text-prius-slate">/ {stats.sombrillas.total}</span></span>
              </div>
              <div className="mt-2"><Bar pct={stats.sombrillas.pct} /></div>
            </button>
          </div>

          <div className="flex flex-col gap-1.5 mt-space-md pt-space-md border-t border-hairline">
            <MiniStat label="Mix Temporada / Período / Día" value={`${stats.mix.temporada}/${stats.mix.periodo}/${stats.mix.dia}`} />
            <MiniStat label="Sin confirmar" value={stats.pendientes.sinVerificar ? `${stats.pendientes.count}+` : stats.pendientes.count} />
          </div>
        </div>

        {/* Cobranzas temporada (antes "Caja y dinero") */}
        <div className="card-light rounded-2xl p-space-lg flex flex-col justify-between min-w-0">
          <div>
            {puedeVerReportes && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-label-md text-prius-slate uppercase">Cobranzas Temporada</span>
                  <span className="px-2.5 py-1 rounded-full bg-prius-surface text-prius-success text-label-md font-semibold">
                    {formatPorcentaje(pctPercibido * 100, 1)} Percibido
                  </span>
                </div>
                {/* Reportes oculto de momento (oct 2026, flag `reportes`
                    en false) — esta card sigue mostrando el dato real, pero
                    deja de ser un link a una pantalla que no está en la
                    navegación. */}
                <button
                  onClick={isFeatureEnabled('reportes') ? () => navigate('/app/reportes') : undefined}
                  className={`w-full mt-space-md flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between text-left whitespace-normal ${isFeatureEnabled('reportes') ? '' : 'cursor-default'}`}
                >
                  <div className="min-w-0">
                    <span className="block text-label-md text-prius-slate uppercase">Total Recaudado</span>
                    <span className="text-metric-xl text-black">{formatPesos(totalCobrado)}</span>
                  </div>
                  <div className="min-w-0 sm:text-right">
                    <span className="text-title-md text-prius-slate">Meta presupuestada</span>
                    <span className="block text-body-sm text-prius-slate">{formatPesos(facturacionBruta)}</span>
                  </div>
                </button>
                <div className="mt-3"><Bar pct={pctPercibido} tone="success" /></div>
              </>
            )}
            {!puedeVerReportes && (
              <div className="flex items-center justify-between">
                <span className="text-label-md text-prius-slate uppercase">Caja y Cobranzas</span>
              </div>
            )}
          </div>

          <div className={`grid grid-cols-2 gap-space-md ${puedeVerReportes ? 'mt-space-lg pt-space-md border-t border-hairline' : 'mt-space-md'}`}>
            <button onClick={() => navigate('/app/reservas')} className="p-space-md rounded-xl bg-prius-surface text-left flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-label-md text-prius-slate uppercase"><AlertTriangle size={14} className="text-prius-error" /> Pendientes</span>
              </div>
              <div className="mt-2">
                <span className="text-headline-sm text-black">{stats.pendientes.saldo > 0 ? formatPesos(stats.pendientes.saldo) : formatPesos(0)}</span>
                <p className="text-body-sm text-prius-slate mt-0.5">{stats.pendientes.count} reservas con saldo</p>
              </div>
            </button>
            <button onClick={() => navigate('/app/caja')} className="p-space-md rounded-xl bg-prius-surface text-left flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-label-md text-prius-slate uppercase"><Wallet size={14} className="text-prius-success" /> Caja Hoy</span>
              </div>
              <div className="mt-2">
                <span className="text-headline-sm text-black">{stats.ingresosDelDia != null ? formatPesos(stats.ingresosDelDia) : formatPesos(0)}</span>
                <p className="text-body-sm text-prius-slate mt-0.5">Ingresos del día</p>
              </div>
            </button>
          </div>

          {/* Alerta de deuda — mobile, como en el mock */}
          {puedeVerReportes && deudaExterna > 0 && (
            <button onClick={() => navigate('/app/reservas')} className="lg:hidden p-2.5 rounded-xl bg-red-50 flex items-center justify-between mt-space-sm">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-prius-error" />
                <span className="text-body-sm text-black font-medium">{stats.pendientes.count} reservas con deuda</span>
              </div>
              <span className="text-title-md font-bold text-prius-error">{formatPesos(deudaExterna)}</span>
            </button>
          )}
        </div>
      </section>

      {/* Fila 4: llegan hoy (desktop, si está prendida la feature) */}
      {recepcionOn && (
        <section className="hidden lg:block">
          <button
            onClick={() => navigate('/app/recepcion')}
            className="w-full card-light rounded-2xl p-space-md flex items-center justify-between hover:bg-prius-subtle transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <QrCode size={20} className="text-black" />
              <span className="text-title-md text-black">Llegan hoy</span>
            </div>
            <span className="text-headline-sm text-black">{llegadasHoy.length}</span>
          </button>
        </section>
      )}

      {/* Fila 5: últimos movimientos */}
      <section className="card-light rounded-2xl p-space-md lg:p-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md">
          <div>
            <h2 className="text-headline-sm text-black flex items-center gap-2">
              Últimos movimientos
              <span className="w-1.5 h-1.5 rounded-full bg-prius-success" />
            </h2>
            <p className="hidden lg:block text-body-sm text-prius-slate">Registro auditable de accesos, modificaciones y transacciones</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center p-1 rounded-xl bg-prius-surface">
              {TABS_MOVIMIENTOS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTabMovimientos(t.key)}
                  className={`px-3 py-1 rounded-lg text-label-md transition-colors ${tabMovimientos === t.key ? 'bg-white text-black' : 'text-prius-slate hover:text-black'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={() => navigate('/app/historial')} className="text-label-lg text-prius-slate hover:text-black transition-colors flex items-center gap-1">
              Ver todo <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {historialLoading ? (
          <p className="text-body-sm text-prius-muted uppercase tracking-widest animate-pulse py-4 text-center">Cargando...</p>
        ) : movimientosFiltrados.length === 0 ? (
          <p className="text-body-sm text-prius-muted py-4 text-center">Sin movimientos recientes.</p>
        ) : (
          <div className="flex flex-col divide-y divide-hairline lg:divide-y-0">
            {movimientosFiltrados.map((ev) => {
              const Icon = iconoMovimiento(ev)
              return (
                <button
                  key={ev.id}
                  onClick={() => {
                    if (ev.tabla === 'reservas' && ev.registro_id) navigate(linkToReserva(ev.registro_id))
                    else if (ev.cliente_id) navigate(linkToCliente(ev.cliente_id))
                  }}
                  className="w-full flex items-center justify-between gap-3 py-2.5 lg:py-3.5 text-left hover:bg-prius-subtle rounded-xl px-2 -mx-2 transition-colors lg:border-b lg:border-hairline lg:last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-prius-surface flex items-center justify-center shrink-0 text-black">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-title-md text-black truncate">{formatMontosEnTexto(ev.descripcion)}</p>
                      <p className="text-body-sm text-prius-slate truncate">
                        {ev.actor_nombre || 'Sistema'}{ev.cliente_nombre ? ` · ${ev.cliente_nombre}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-label-md text-prius-slate tabular-nums shrink-0">{formatHora(ev.ts)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

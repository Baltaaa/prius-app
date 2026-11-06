import { hoyAR } from '../../lib/fechas'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { useCaja } from '../../hooks/useCaja'
import { useLeads } from '../../hooks/useLeads'
import { useHistorial } from '../../hooks/useHistorial'
import { useData } from '../../context/DataProvider'
import { useAuth, usePermiso } from '../../context/AuthProvider'
import { useNuevaReserva } from '../../context/NuevaReservaProvider'
import { supabase } from '../../lib/supabase'
import { calcularPlanoStats } from '../../lib/planoStats'
import { resumenSaldos } from '../../lib/saldos'
import { buildUnitsMap } from '../../lib/planoUnits'
import { formatHora, formatMontosEnTexto, formatPorcentaje } from '../../lib/format'
import MonedaSwitch, { useMonedaVista } from '../../components/ui/MonedaSwitch'
import { linkToReserva, linkToCliente } from '../../lib/deepLinks'
import { isFeatureEnabled } from '../../lib/features'
import { useClima } from '../../hooks/useClima'
import { useInitialLoad, useTimeoutFallback } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'
import ClimaHero from '../../components/dashboard/ClimaHero'
import ActivityList from '../../components/brand/ActivityList'
import { DeltaBadge } from '../../components/brand/Badge'
import Card from '../../components/brand/Card'
import HeroCard from '../../components/brand/HeroCard'
import QuickActions from '../../components/brand/QuickActions'
import SegmentedBar from '../../components/brand/SegmentedBar'
import SegmentedControl from '../../components/brand/SegmentedControl'
import SidebarCajaCard from '../../components/brand/SidebarCajaCard'
import OjitoMontos from '../../components/brand/OjitoMontos'
import { Rayas } from '../../components/brand/patterns'
import CountUp from '../../components/brand/motion/CountUp'
import Reveal from '../../components/brand/motion/Reveal'
import {
  AlertTriangle, ArrowRight, BookmarkPlus, CreditCard, Inbox, LogIn, Map, PenLine,
  QrCode, TimerOff, UserCheck2, UserSearch,
} from 'lucide-react'

const todayStr = hoyAR

const ChipDato = ({ icon: Icon, label, value, onClick }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-card text-label text-ink-2 hover:text-ink anim-colors shrink-0">
    <Icon size={18} strokeWidth={1.5} />
    {label}
    <span className="text-body text-ink tabular-nums">{value}</span>
  </button>
)

export default function Home() {
  // Switch Pesos/Dólares (31/10/2026) — solo presentación, ver MonedaSwitch.
  const mv = useMonedaVista()
  const fmtM = mv.fmt
  const navigate = useNavigate()
  const { abrirNuevaReserva } = useNuevaReserva()
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
    () => calcularPlanoStats({ units, pagos, reservas, cajaDelDia: cajaHoy, selectedDate: hoy }),
    [units, pagos, reservas, cajaHoy, hoy],
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

  // Cobranzas y pendientes de la TEMPORADA completa: misma fuente que la ficha
  // y que el Plano (lib/saldos.js). El Plano suma solo lo que ocupa el mapa un
  // día; acá entran todas las reservas vigentes. Solo el bloque de total
  // cobrado queda detrás de `puedeVerReportes`; Pendientes e Ingresos del día
  // los ve cualquier rol.
  const saldos = useMemo(() => resumenSaldos({ reservas, pagos }), [reservas, pagos])
  const totalCobrado = saldos.cobrado
  const pctPercibido = saldos.pctCobrado

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
      <div className="flex flex-col gap-grid">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-grid">
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-grid">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    )
  }

  const iconoMovimiento = (ev) => {
    if (ev.tabla === 'auth' && ev.tipo_evento === 'login') return LogIn
    if (ev.tabla === 'auth') return TimerOff
    return PenLine
  }

  // Accesos a pantallas y modales que ya existen, sin funcionalidad nueva.
  // Registrar un pago necesita una reserva, por eso Cobrar lleva a las que
  // tienen saldo. La Caja vive en la tarjeta del sidebar.
  const accesos = [
    { key: 'reservar', label: 'Reservar', icon: BookmarkPlus, onClick: () => abrirNuevaReserva() },
    { key: 'cobrar', label: 'Cobrar', icon: CreditCard, onClick: () => navigate('/app/reservas?filtroEstado=con_saldo') },
    { key: 'checkin', label: 'Check-in', icon: UserCheck2, onClick: () => navigate('/app/recepcion') },
    { key: 'buscar', label: 'Buscar cliente', icon: UserSearch, onClick: () => navigate('/app/clientes') },
    { key: 'plano', label: 'Plano', icon: Map, onClick: () => navigate('/app/plano') },
    { key: 'leads', label: 'Leads', icon: Inbox, onClick: () => navigate('/app/leads') },
  ]

  const pendientesSaldo = saldos.pendiente
  const reportesOn = isFeatureEnabled('reportes')
  const cajaSubtitulo = cajaHoy?.abierta_at && perfilesPorId[cajaHoy.abierta_por]
    ? `Desde ${formatHora(cajaHoy.abierta_at)} · ${perfilesPorId[cajaHoy.abierta_por]}`
    : undefined

  const movimientos = movimientosFiltrados.map((ev) => ({
    id: ev.id,
    icon: iconoMovimiento(ev),
    title: formatMontosEnTexto(ev.descripcion),
    subtitle: `${ev.actor_nombre || 'Sistema'}${ev.cliente_nombre ? ` · ${ev.cliente_nombre}` : ''}`,
    meta: formatHora(ev.ts),
    onClick: () => {
      if (ev.tabla === 'reservas' && ev.registro_id) navigate(linkToReserva(ev.registro_id))
      else if (ev.cliente_id) navigate(linkToCliente(ev.cliente_id))
    },
  }))

  return (
    <div className="flex flex-col gap-grid">
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-grid">
        <Reveal index={0} className="min-w-0">
          <HeroCard
            className="h-full"
            title={puedeVerReportes ? 'Cobranzas temporada' : 'Caja y cobranzas'}
            action={<MonedaSwitch moneda={mv.moneda} onChange={mv.setMoneda} cotizacion={mv.cotizacion} fecha={mv.fecha} stale={mv.stale} compacto />}
          >
            {/* KPI + ojito del modo privacidad global (el mismo estado que el de la card de Caja). */}
            <div className="mt-6 md:mt-8 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={puedeVerReportes && reportesOn ? () => navigate('/app/reportes') : undefined}
                className={`min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-left whitespace-normal ${puedeVerReportes && reportesOn ? '' : 'cursor-default'}`}
              >
                <span className="text-kpi"><CountUp value={puedeVerReportes ? totalCobrado : pendientesSaldo} format={fmtM} /></span>
                {puedeVerReportes && <DeltaBadge value={formatPorcentaje(pctPercibido * 100, 1)} />}
              </button>
              <OjitoMontos sobre="claro" className="-mr-2" />
            </div>

            <div className="mt-auto pt-6 md:pt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <button type="button" onClick={() => navigate('/app/reservas')} className="text-body text-left whitespace-normal">
                {puedeVerReportes && <><span className="font-semibold tabular-nums">{fmtM(pendientesSaldo)}</span> pendientes de la temporada · </>}
                {saldos.conSaldo} reservas con saldo
              </button>
              <span className="text-label">Actualizado en tiempo real</span>
            </div>

            {saldos.sinVerificar > 0 && (
              <button type="button" onClick={() => navigate('/app/clientes')} className="mt-3 flex items-center gap-2 text-label text-left whitespace-normal">
                <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0" />
                {saldos.sinVerificar} {saldos.sinVerificar === 1 ? 'reserva' : 'reservas'} con saldo sin verificar, no incluidas en el pendiente
              </button>
            )}
          </HeroCard>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card className="h-full"><QuickActions items={accesos} /></Card>
        </Reveal>
      </section>

      {/* En desktop la caja vive en el sidebar. */}
      <Reveal index={2} className="lg:hidden">
        <SidebarCajaCard subtitulo={cajaSubtitulo} className="p-5" />
      </Reveal>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-grid">
        <Reveal index={3} className="min-w-0">
          <ClimaHero fecha={hoy} clima={clima} loading={climaLoading} />
        </Reveal>

        <Reveal index={4} className="min-w-0">
          <Card
            className="h-full relative overflow-hidden"
            title="Capacidad diaria"
            action={<button type="button" onClick={() => navigate('/app/plano')} className="btn btn-ghost h-9 px-3">Ver plano</button>}
          >
            <Rayas opacity={0.03} />
            <div className="relative">
              <p className="flex items-baseline gap-2 mb-4">
                <span className="text-stat text-ink"><CountUp value={Math.round(stats.ocupacion.pct * 100)} format={(v) => formatPorcentaje(v)} /></span>
                <span className="text-label text-ink-2">{stats.ocupacion.count} de {stats.ocupacion.total} ocupadas</span>
              </p>
              <SegmentedBar
                label={`Ocupación del día: ${stats.carpas.count} carpas, ${stats.sombrillas.count} sombrillas y ${stats.libres.count} libres`}
                items={[
                  { key: 'carpas', label: 'Carpas ocupadas', value: stats.carpas.count, detail: `${stats.carpas.count} de ${stats.carpas.total}`, swatch: 'bg-gold' },
                  { key: 'sombrillas', label: 'Sombrillas ocupadas', value: stats.sombrillas.count, detail: `${stats.sombrillas.count} de ${stats.sombrillas.total}`, swatch: 'bg-ink' },
                  { key: 'libres', label: 'Libres', value: stats.libres.count, swatch: 'bg-line' },
                ]}
              />
              <dl className="mt-4 pt-4 border-t border-divider space-y-2 text-label">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-2">Mix temporada / período / día</dt>
                  <dd className="text-ink tabular-nums">{stats.mix.temporada}/{stats.mix.periodo}/{stats.mix.dia}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-2">Pendientes de pago hoy</dt>
                  <dd className="text-ink tabular-nums">{stats.pendientes.count}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-2">Sin confirmar</dt>
                  <dd className="text-ink tabular-nums">{stats.sinConfirmar.count}</dd>
                </div>
              </dl>
            </div>
          </Card>
        </Reveal>
      </section>

      <Reveal index={5} className="flex gap-2 overflow-x-auto scrollbar-none -mx-page px-page md:mx-0 md:px-0">
        {recepcionOn && <ChipDato icon={QrCode} label="Llegan hoy" value={llegadasHoy.length} onClick={() => navigate('/app/recepcion')} />}
        <ChipDato icon={Inbox} label="Leads sin contactar" value={leadsLoading ? '—' : leadsSinContactar} onClick={() => navigate('/app/leads?estado=nuevo')} />
      </Reveal>

      <Reveal index={6}>
        <Card
          title="Últimos movimientos"
          action={
            <div className="flex items-center gap-2">
              <SegmentedControl
                className="hidden lg:inline-flex"
                label="Filtrar movimientos"
                options={TABS_MOVIMIENTOS.map((t) => ({ value: t.key, label: t.label }))}
                value={tabMovimientos}
                onChange={setTabMovimientos}
              />
              <button type="button" onClick={() => navigate('/app/historial')} className="btn btn-ghost h-9 px-3">
                Ver todo <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          }
        >
          {historialLoading
            ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            : <ActivityList items={movimientos} empty="Sin movimientos recientes." />}
        </Card>
      </Reveal>
    </div>
  )
}

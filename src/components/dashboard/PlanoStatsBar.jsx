import { useState } from 'react'
import { Activity, AlertCircle, DoorOpen, Hourglass, Layers, Tent, Umbrella, Wallet } from 'lucide-react'
import { formatPesos } from '../../lib/format'
import { COLOR_TIPO_ALQUILER } from '../../lib/colors'
import { useClima } from '../../hooks/useClima'
import ClimaChip from './ClimaChip'
import ClimaPanel from './ClimaPanel'

const pct = (n) => `${Math.round((n || 0) * 100)}%`

/**
 * Tarjeta de stat — mismo lenguaje visual que `KpiCard.jsx` (ícono en caja
 * con borde, etiqueta mayúscula chica, valor grande, barra de progreso fina
 * opcional). Exportada para que tanto la fila compacta de este archivo
 * (mobile/tablet) como el riel de Dashboard.jsx (desktop >=1280px) usen
 * exactamente la misma tarjeta — solo cambia el ancho (`className`) y,
 * para "Ocupación" en el riel, `size="lg"`.
 */
export function StatCard({ icon: Icon, label, active, onClick, progress, size = 'md', children, className = '' }) {
  const interactivo = typeof onClick === 'function'
  const Tag = interactivo ? 'button' : 'div'
  const lg = size === 'lg'
  return (
    <Tag
      type={interactivo ? 'button' : undefined}
      onClick={onClick}
      className={`group shrink-0 snap-start relative overflow-hidden rounded-2xl border text-left transition-all ${lg ? 'p-5' : 'p-3.5'} ${
        active
          ? 'border-[#F2CA50]/50 bg-[#F2CA50]/10'
          : 'border-white/10 bg-white/[0.04]'
      } ${interactivo ? 'hover:border-white/20 hover:bg-white/[0.07] cursor-pointer' : ''} ${className}`}
    >
      <div className={`flex items-center gap-2 ${lg ? 'mb-3.5' : 'mb-2.5'}`}>
        <div className={`rounded-lg flex items-center justify-center border shrink-0 transition-colors ${lg ? 'w-9 h-9' : 'w-7 h-7'} ${
          active ? 'border-[#F2CA50]/40 bg-[#F2CA50]/10' : 'border-white/10 bg-white/5 group-hover:border-white/20'
        }`}>
          <Icon size={lg ? 18 : 14} className={active ? 'text-[#F2CA50]' : 'text-gray-400'} />
        </div>
        <p className={`font-bold text-gray-400 uppercase tracking-widest truncate ${lg ? 'text-[10px]' : 'text-[9px]'}`}>{label}</p>
      </div>
      {children}
      {progress != null && (
        <div className={`rounded-full bg-white/10 overflow-hidden ${lg ? 'mt-4 h-[5px]' : 'mt-2.5 h-[3px]'}`}>
          <div
            className="h-full rounded-full bg-[#F2CA50] transition-all"
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
    </Tag>
  )
}

export function OcupacionCard({ stats, filtro, onToggleFiltro, size, className = 'w-[132px]' }) {
  const lg = size === 'lg'
  return (
    <StatCard icon={Activity} label="Ocupación" active={filtro === 'ocupacion'} onClick={() => onToggleFiltro('ocupacion')} progress={stats.ocupacion.pct} size={size} className={className}>
      <p className={`font-bold text-white tabular-nums leading-none ${lg ? 'text-4xl' : 'text-2xl'}`}>{pct(stats.ocupacion.pct)}</p>
      <p className={`text-gray-500 tabular-nums mt-1 ${lg ? 'text-xs' : 'text-[10px] mt-0.5'}`}>{stats.ocupacion.count}/{stats.ocupacion.total} unidades</p>
    </StatCard>
  )
}

export function CarpasCard({ stats, filtro, onToggleFiltro, className = 'w-[112px]' }) {
  return (
    <StatCard icon={Tent} label="Carpas" active={filtro === 'carpas'} onClick={() => onToggleFiltro('carpas')} progress={stats.carpas.pct} className={className}>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{pct(stats.carpas.pct)}</p>
      <p className="text-[10px] text-gray-500 tabular-nums mt-0.5">{stats.carpas.count}/{stats.carpas.total}</p>
    </StatCard>
  )
}

export function SombrillasCard({ stats, filtro, onToggleFiltro, className = 'w-[112px]' }) {
  return (
    <StatCard icon={Umbrella} label="Sombrillas" active={filtro === 'sombrillas'} onClick={() => onToggleFiltro('sombrillas')} progress={stats.sombrillas.pct} className={className}>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{pct(stats.sombrillas.pct)}</p>
      <p className="text-[10px] text-gray-500 tabular-nums mt-0.5">{stats.sombrillas.count}/{stats.sombrillas.total}</p>
    </StatCard>
  )
}

export function LibresCard({ stats, filtro, onToggleFiltro, className = 'w-[100px]' }) {
  return (
    <StatCard icon={DoorOpen} label="Libres hoy" active={filtro === 'libres'} onClick={() => onToggleFiltro('libres')} className={className}>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{stats.libres.count}</p>
    </StatCard>
  )
}

export function MixCard({ stats, filtro, onToggleFiltro, className = 'w-[172px]' }) {
  return (
    <StatCard icon={Layers} label="Mix de alquiler" className={className}>
      <div className="flex items-center gap-3">
        {[
          ['temporada', 'T', stats.mix.temporada],
          ['periodo', 'P', stats.mix.periodo],
          ['dia', 'D', stats.mix.dia],
        ].map(([key, letra, valor]) => (
          <button
            key={key}
            type="button"
            onClick={() => onToggleFiltro(key)}
            className={`flex items-center gap-1.5 text-sm font-bold tabular-nums transition-colors ${
              filtro === key ? 'text-[#F2CA50]' : 'text-white hover:text-[#F2CA50]'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLOR_TIPO_ALQUILER[key]?.swatch }} />
            {letra} {valor}
          </button>
        ))}
      </div>
    </StatCard>
  )
}

export function PendientesCard({ stats, filtro, onToggleFiltro, className = 'w-[152px]' }) {
  return (
    <StatCard icon={AlertCircle} label="Pendientes" active={filtro === 'pendientes'} onClick={() => onToggleFiltro('pendientes')} className={className}>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{stats.pendientes.count}</p>
      <p className="text-[10px] text-red-400 tabular-nums font-bold mt-0.5 truncate">
        {stats.pendientes.saldo > 0 ? formatPesos(stats.pendientes.saldo) : null}
        {stats.pendientes.sinVerificar && ' + sin verificar'}
      </p>
    </StatCard>
  )
}

export function IngresosCard({ stats, className = 'w-[150px]' }) {
  return (
    <StatCard icon={Wallet} label="Ingresos del día" className={className}>
      <p className="text-2xl font-bold text-white tabular-nums leading-none truncate">
        {stats.ingresosDelDia != null ? formatPesos(stats.ingresosDelDia) : '—'}
      </p>
    </StatCard>
  )
}

/** Autocontenido: pide su propio clima y maneja el estado de su modal — un
 * solo lugar con esta lógica, usado tanto en la fila compacta como en el
 * riel derecho. */
export function ClimaCard({ selectedDate, className }) {
  const { clima, loading } = useClima(selectedDate)
  const [open, setOpen] = useState(false)
  return (
    <>
      <ClimaChip clima={clima} loading={loading} onClick={() => setOpen(true)} className={className} />
      <ClimaPanel isOpen={open} onClose={() => setOpen(false)} clima={clima} loading={loading} selectedDate={selectedDate} />
    </>
  )
}

/** Leyenda compacta de estados de unidad (riel izquierdo, desktop) — mismos
 * 4 estados y mismos estilos que `Cell.jsx`, sin reimplementar esa lógica:
 * solo un recordatorio visual de qué significa cada marca del plano. */
export function EstadoLegend() {
  const item = (swatchClass, label, children) => (
    <div className="flex items-center gap-2.5">
      <div className={`w-4.5 h-4.5 rounded-sm border flex items-center justify-center shrink-0 ${swatchClass}`}>{children}</div>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  )
  return (
    <div className="space-y-2 pt-1">
      {item(`${COLOR_TIPO_ALQUILER.temporada.bg} ${COLOR_TIPO_ALQUILER.temporada.border}`, 'Alquilada (T/P/D)', <span className="text-[8px] font-bold text-black">T</span>)}
      {item('bg-white border-white', 'Pendiente de confirmar', <Hourglass size={9} className="text-black" />)}
      {item('bg-white/5 border-white/10', 'Libre')}
      <div className="flex items-center gap-2.5">
        <div className="w-4.5 h-4.5 rounded-sm border border-white/10 bg-white/5 flex items-center justify-center shrink-0 relative">
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
        <span className="text-[11px] text-gray-400">Saldada (punto verde)</span>
      </div>
    </div>
  )
}

const SkeletonCard = () => <div className="shrink-0 h-[84px] w-[132px] rounded-2xl bg-white/5 animate-pulse" />

/**
 * Fila compacta de stats — usada en mobile (<768px, sin cambios de
 * comportamiento) y en la franja superior de tablet (768–1279px). En
 * desktop (>=1280px) Dashboard.jsx no monta esto: arma el riel con las
 * mismas tarjetas de arriba, apiladas verticalmente.
 */
export default function PlanoStatsBar({ stats, selectedDate, filtro, onToggleFiltro, loading }) {
  if (loading || !stats) {
    return (
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none">
        {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory sm:snap-none pb-1">
      <OcupacionCard stats={stats} filtro={filtro} onToggleFiltro={onToggleFiltro} />
      <CarpasCard stats={stats} filtro={filtro} onToggleFiltro={onToggleFiltro} />
      <SombrillasCard stats={stats} filtro={filtro} onToggleFiltro={onToggleFiltro} />
      <MixCard stats={stats} filtro={filtro} onToggleFiltro={onToggleFiltro} />
      <PendientesCard stats={stats} filtro={filtro} onToggleFiltro={onToggleFiltro} />
      <LibresCard stats={stats} filtro={filtro} onToggleFiltro={onToggleFiltro} />
      <IngresosCard stats={stats} />
      <ClimaCard selectedDate={selectedDate} className="w-[172px]" />
    </div>
  )
}

import { ArrowUp, Cloud, CloudRain, Wind } from 'lucide-react'
import { UMBRAL_RAFAGA_ALERTA_KMH } from '../../config/clima'
import { resumenDiaClima } from '../../lib/clima'

// Mismo lenguaje visual que StatCard (PlanoStatsBar) — ícono en caja con
// borde, etiqueta mayúscula chica, valor grande — con un estado de alerta
// sobrio (ámbar, nunca rojo chillón) cuando el viento o la ráfaga pico del
// día superan `UMBRAL_RAFAGA_ALERTA_KMH`.
export default function ClimaChip({ clima, loading, onClick, className = 'w-[172px]' }) {
  if (loading) {
    return <div className={`shrink-0 h-[84px] rounded-2xl bg-white/5 animate-pulse ${className}`} />
  }

  const resumen = resumenDiaClima(clima)

  if (!resumen) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20 transition-all p-3.5 text-left ${className}`}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 shrink-0">
            <Cloud size={14} className="text-gray-400" />
          </div>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Clima</p>
        </div>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Sin pronóstico</p>
      </button>
    )
  }

  const { actual, rafagaMax, vientoMax } = resumen
  const alerta = Math.max(rafagaMax, vientoMax) >= UMBRAL_RAFAGA_ALERTA_KMH
  const lluvia = Number(actual.precipitacion) > 0.2
  // wind_direction_10m de Open-Meteo es de dónde SOPLA el viento (convención
  // meteorológica) — +180° para que la flecha apunte hacia dónde va, que es
  // lo intuitivo en un ícono.
  const rotacionFlecha = (Number(actual.direccion) || 0) + 180
  const IconoClima = alerta ? Wind : lluvia ? CloudRain : Cloud

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group shrink-0 snap-start rounded-2xl border transition-all p-3.5 text-left ${className} ${
        alerta
          ? 'border-amber-500/40 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]'
          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20'
      }`}
      title={alerta ? 'Viento fuerte — tocar para ver el detalle' : 'Clima — tocar para ver el detalle'}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
          alerta ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5'
        }`}>
          <IconoClima size={14} className={alerta ? 'text-amber-300' : 'text-gray-400'} />
        </div>
        <p className={`text-[9px] font-bold uppercase tracking-widest ${alerta ? 'text-amber-300' : 'text-gray-400'}`}>
          {alerta ? 'Viento fuerte' : 'Clima'}
        </p>
      </div>
      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold text-white tabular-nums leading-none">
          {actual.temperatura != null ? Math.round(actual.temperatura) : '--'}°
        </p>
        <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-gray-300 pb-0.5">
          <ArrowUp size={12} style={{ transform: `rotate(${rotacionFlecha}deg)` }} />
          {actual.viento != null ? Math.round(actual.viento) : '--'} km/h
        </div>
      </div>
      <p className={`text-[10px] tabular-nums mt-1 ${alerta ? 'text-amber-300/90 font-bold' : 'text-gray-500'}`}>
        ráfaga {Math.round(rafagaMax)} km/h{actual.olaAltura != null ? ` · ola ${Number(actual.olaAltura).toFixed(1)} m` : ''}
      </p>
    </button>
  )
}

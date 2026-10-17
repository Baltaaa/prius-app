import { ArrowUp, Cloud, CloudRain, Wind } from 'lucide-react'
import { UMBRAL_RAFAGA_ALERTA_KMH } from '../../config/clima'
import { resumenDiaClima } from '../../lib/clima'

// Mismo lenguaje visual que StatCard (PlanoStatsBar) — ícono en caja con
// borde, etiqueta mayúscula chica, valor grande — con un estado de alerta
// sobrio (ámbar, nunca rojo chillón) cuando el viento o la ráfaga pico del
// día superan `UMBRAL_RAFAGA_ALERTA_KMH`.
export default function ClimaChip({ clima, loading, onClick, className = 'w-[172px]' }) {
  // Bug real (oct 2026): este chip pega a una Edge Function por red (nunca
  // instantáneo como el resto de las tarjetas, que leen de `useData()` ya
  // en memoria) — el esqueleto de acá no tenía ícono ni label, así que
  // durante ese rato se veía como una tarjeta vacía/rota, no "cargando".
  if (loading) {
    return (
      <div className={`shrink-0 rounded-2xl border border-hairline bg-white/[0.04] p-3.5 animate-pulse ${className}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-hairline bg-prius-subtle shrink-0">
            <Cloud size={14} className="text-prius-muted" />
          </div>
          <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest">Clima</p>
        </div>
        <div className="h-6 w-16 rounded bg-prius-subtle" />
      </div>
    )
  }

  const resumen = resumenDiaClima(clima)

  if (!resumen) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group shrink-0 snap-start rounded-2xl border border-hairline bg-white/[0.04] hover:bg-white/[0.07] hover:border-hairline transition-all p-3.5 text-left ${className}`}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-hairline bg-prius-subtle shrink-0">
            <Cloud size={14} className="text-prius-slate" />
          </div>
          <p className="text-[9px] font-bold text-prius-slate uppercase tracking-widest">Clima</p>
        </div>
        <p className="text-sm font-bold text-prius-muted uppercase tracking-wide">Sin pronóstico</p>
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
          : 'border-hairline bg-white/[0.04] hover:bg-white/[0.07] hover:border-hairline'
      }`}
      title={alerta ? 'Viento fuerte — tocar para ver el detalle' : 'Clima — tocar para ver el detalle'}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
          alerta ? 'border-amber-500/40 bg-amber-500/10' : 'border-hairline bg-prius-subtle'
        }`}>
          <IconoClima size={14} className={alerta ? 'text-amber-300' : 'text-prius-slate'} />
        </div>
        <p className={`text-[9px] font-bold uppercase tracking-widest ${alerta ? 'text-amber-300' : 'text-prius-slate'}`}>
          {alerta ? 'Viento fuerte' : 'Clima'}
        </p>
      </div>
      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold text-black tabular-nums leading-none">
          {actual.temperatura != null ? Math.round(actual.temperatura) : '--'}°
        </p>
        <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-prius-slate pb-0.5">
          <ArrowUp size={12} style={{ transform: `rotate(${rotacionFlecha}deg)` }} />
          {actual.viento != null ? Math.round(actual.viento) : '--'} km/h
        </div>
      </div>
      <p className={`text-[10px] tabular-nums mt-1 ${alerta ? 'text-amber-300/90 font-bold' : 'text-prius-muted'}`}>
        ráfaga {Math.round(rafagaMax)} km/h{actual.olaAltura != null ? ` · ola ${Number(actual.olaAltura).toFixed(1)} m` : ''}
      </p>
    </button>
  )
}

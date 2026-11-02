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
      <div className={`shrink-0 rounded-card border border-line bg-surface p-3.5 animate-pulse ${className}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-icon flex items-center justify-center border border-line bg-surface shrink-0">
            <Cloud size={14} className="text-ink-2" />
          </div>
          <p className="text-[9px] font-bold text-ink-2 uppercase tracking-widest">Clima</p>
        </div>
        <div className="h-6 w-16 rounded-swatch bg-surface" />
      </div>
    )
  }

  const resumen = resumenDiaClima(clima)

  if (!resumen) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group shrink-0 snap-start rounded-card border border-line bg-surface hover:bg-surface hover:border-line transition-all p-3.5 text-left ${className}`}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-icon flex items-center justify-center border border-line bg-surface shrink-0">
            <Cloud size={14} className="text-ink-2" />
          </div>
          <p className="text-[9px] font-bold text-ink-2 uppercase tracking-widest">Clima</p>
        </div>
        <p className="text-body font-bold text-ink-2 uppercase tracking-wide">Sin pronóstico</p>
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
      className={`group shrink-0 snap-start rounded-card border transition-all p-3.5 text-left ${className} ${
        alerta
          ? 'border-gold-300 bg-gold-100 hover:bg-gold-100'
          : 'border-line bg-surface hover:bg-surface hover:border-line'
      }`}
      title={alerta ? 'Viento fuerte — tocar para ver el detalle' : 'Clima — tocar para ver el detalle'}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-7 h-7 rounded-icon flex items-center justify-center border shrink-0 ${
          alerta ? 'border-gold-300 bg-gold-100' : 'border-line bg-surface'
        }`}>
          <IconoClima size={14} className={alerta ? 'text-ink' : 'text-ink-2'} />
        </div>
        <p className={`text-[9px] font-bold uppercase tracking-widest ${alerta ? 'text-ink' : 'text-ink-2'}`}>
          {alerta ? 'Viento fuerte' : 'Clima'}
        </p>
      </div>
      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold text-ink tabular-nums leading-none">
          {actual.temperatura != null ? Math.round(actual.temperatura) : '--'}°
        </p>
        <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink-2 pb-0.5">
          <ArrowUp size={12} style={{ transform: `rotate(${rotacionFlecha}deg)` }} />
          {actual.viento != null ? Math.round(actual.viento) : '--'} km/h
        </div>
      </div>
      <p className={`text-[10px] tabular-nums mt-1 ${alerta ? 'text-ink font-bold' : 'text-ink-2'}`}>
        ráfaga {Math.round(rafagaMax)} km/h{actual.olaAltura != null ? ` · ola ${Number(actual.olaAltura).toFixed(1)} m` : ''}
      </p>
    </button>
  )
}

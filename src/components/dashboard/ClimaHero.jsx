import { useState } from 'react'
import { ArrowUp, Cloud, CloudRain, ExternalLink, Gauge, Waves, Wind } from 'lucide-react'
import { useClima } from '../../hooks/useClima'
import { resumenDiaClima } from '../../lib/clima'
import { UMBRAL_RAFAGA_ALERTA_KMH, WINDGURU_SPOT_ID } from '../../config/clima'
import ClimaPanel from './ClimaPanel'

const WINDGURU_URL = `https://www.windguru.cz/${WINDGURU_SPOT_ID}`

/**
 * Card de clima destacada del Dashboard (oct 2026) — mismo hook/fuente que
 * el Plano (`useClima`, Edge Function `clima-playa`), cero lógica nueva:
 * reusa `resumenDiaClima` (lib/clima.js) y, para el detalle hora por hora +
 * el widget de Windguru, abre el mismo `ClimaPanel` que ya usa el Plano —
 * no se duplica esa parte. Solo el "pantallazo" de acá (hero horizontal) es
 * nuevo, porque el lugar donde vive (card grande arriba del Dashboard) es
 * otro que el chip angosto del riel del Plano.
 *
 * No existe hoy ningún resumen/recomendación generado con IA en el sistema
 * de clima — no se inventa acá.
 */
export default function ClimaHero({ fecha }) {
  const { clima, loading } = useClima(fecha)
  const [panelOpen, setPanelOpen] = useState(false)
  const resumen = resumenDiaClima(clima)

  if (loading) {
    return <div className="glass-card rounded-3xl p-6 h-[180px] animate-pulse" />
  }

  if (!resumen) {
    return (
      <div className="glass-card rounded-3xl p-6 flex items-center gap-4">
        <Cloud size={28} className="text-gray-500" />
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Clima</p>
          <p className="text-xs text-gray-500 mt-1">Sin pronóstico para hoy.</p>
        </div>
      </div>
    )
  }

  const { actual, rafagaMax, vientoMax } = resumen
  const alerta = Math.max(rafagaMax, vientoMax) >= UMBRAL_RAFAGA_ALERTA_KMH
  const lluvia = Number(actual.precipitacion) > 0.2
  const rotacionFlecha = (Number(actual.direccion) || 0) + 180
  const Icono = alerta ? Wind : lluvia ? CloudRain : Cloud
  const horas = clima?.disponible ? clima.horas : []
  const horaActualIdx = horas.findIndex((h) => h.hora === actual.hora)
  const proximasHoras = horaActualIdx >= 0 ? horas.slice(horaActualIdx, horaActualIdx + 6) : horas.slice(0, 6)

  return (
    <>
      <div className={`glass-card rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center gap-6 ${alerta ? 'border border-amber-500/30' : ''}`}>
        <div className="flex items-center gap-5 shrink-0">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shrink-0 ${alerta ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
            <Icono size={30} className={alerta ? 'text-amber-300' : 'text-[#F2CA50]'} />
          </div>
          <div>
            <p className="text-4xl font-bold text-white tabular-nums leading-none">
              {actual.temperatura != null ? Math.round(actual.temperatura) : '--'}°
            </p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 ${alerta ? 'text-amber-300' : 'text-gray-500'}`}>
              {alerta ? 'Viento fuerte' : 'Mar del Plata · Base Naval'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-gray-200">
            <ArrowUp size={14} style={{ transform: `rotate(${rotacionFlecha}deg)` }} />
            {actual.viento != null ? Math.round(actual.viento) : '--'} km/h
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-bold tabular-nums ${alerta ? 'text-amber-300' : 'text-gray-400'}`}>
            <Gauge size={14} /> ráfaga {Math.round(rafagaMax)} km/h
          </div>
          {actual.olaAltura != null && (
            <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-gray-400">
              <Waves size={14} /> ola {Number(actual.olaAltura).toFixed(1)} m
            </div>
          )}
        </div>

        {proximasHoras.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            {proximasHoras.map((h) => (
              <div key={h.hora} className="shrink-0 w-12 text-center px-1 py-2 bg-white/[0.04] border border-white/10 rounded-lg">
                <p className="text-[9px] font-bold text-gray-500">{h.hora.slice(0, 2)}h</p>
                <p className="text-xs font-bold text-white mt-0.5 tabular-nums">{h.temperatura != null ? Math.round(h.temperatura) : '--'}°</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all"
          >
            Ver pronóstico
          </button>
          <a
            href={WINDGURU_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-[#FDE047] text-black hover:bg-yellow-300 transition-all flex items-center justify-center gap-1.5"
          >
            Windguru <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <ClimaPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} clima={clima} loading={loading} selectedDate={fecha} />
    </>
  )
}

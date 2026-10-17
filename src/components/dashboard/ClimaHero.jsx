import { useState } from 'react'
import { ArrowUp, Cloud, CloudRain, ExternalLink, Gauge, Waves, Wind } from 'lucide-react'
import { useClima } from '../../hooks/useClima'
import { resumenDiaClima, gradosARumbo } from '../../lib/clima'
import { UMBRAL_RAFAGA_ALERTA_KMH, WINDGURU_SPOT_ID } from '../../config/clima'
import ClimaPanel from './ClimaPanel'

const WINDGURU_URL = `https://www.windguru.cz/${WINDGURU_SPOT_ID}`

/**
 * Card de clima del Dashboard — rediseño oct 2026 según mock de Stitch
 * (design/stitch/01-home-*.html, bloque "Condiciones Marítimas"). Mismo
 * hook/fuente que el Plano (`useClima`, Edge Function `clima-playa`), cero
 * lógica nueva: reusa `resumenDiaClima` (lib/clima.js) y el mismo `ClimaPanel`
 * que ya usa el Plano para el detalle hora por hora + Windguru embebido — no
 * se duplica esa parte.
 *
 * El mock trae un tile "AGUA" con temperatura de mar + pleamar — ese dato NO
 * existe hoy en `useClima` (solo viento/ráfaga/ola), así que la grilla queda
 * en 3 tiles (Viento / Ráfaga / Olas) en vez de los 3 del mock (Viento/Olas/
 * Agua) — grilla ajustada a los datos reales, no se inventa un tile vacío.
 *
 * No existe hoy ningún resumen/recomendación generado con IA en el sistema
 * de clima — no se inventa acá.
 */
export default function ClimaHero({ fecha }) {
  const { clima, loading } = useClima(fecha)
  const [panelOpen, setPanelOpen] = useState(false)
  const resumen = resumenDiaClima(clima)

  if (loading) {
    return <div className="card-light rounded-2xl p-space-md sm:p-space-lg h-[220px] animate-pulse" />
  }

  if (!resumen) {
    return (
      <div className="card-light rounded-2xl p-space-md sm:p-space-lg flex items-center gap-space-md">
        <Cloud size={28} className="text-prius-muted" />
        <div>
          <p className="text-label-md text-prius-slate uppercase">Clima</p>
          <p className="text-body-sm text-prius-muted mt-1">Sin pronóstico para hoy.</p>
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
      <div className="card-light rounded-2xl p-space-md sm:p-space-lg flex flex-col justify-between min-w-0 font-ui">
        <div>
          {/* Encabezado: eyebrow + acciones (Windguru / Ver pronóstico) */}
          <div className="flex items-center justify-between pb-space-md">
            <div className="flex items-center gap-2">
              <Wind size={16} className="text-prius-slate" />
              <span className="text-label-md text-prius-slate uppercase hidden sm:inline">Condiciones Marítimas · Biología Costera</span>
              <span className="text-label-md text-prius-slate uppercase sm:hidden">Clima</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={WINDGURU_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-label-md text-black hover:underline flex items-center gap-1"
              >
                Windguru <ExternalLink size={12} />
              </a>
              <span className="text-hairline hidden sm:inline">•</span>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="text-label-md text-prius-slate hover:text-black transition-colors hidden sm:inline"
              >
                Ver pronóstico
              </button>
            </div>
          </div>

          {/* Hero: temperatura + ubicación + alerta de viento */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 py-1">
            <button type="button" onClick={() => setPanelOpen(true)} className="flex items-baseline gap-2 sm:hidden">
              <span className="text-metric-xl text-black tracking-tighter tabular-nums">
                {actual.temperatura != null ? Math.round(actual.temperatura) : '--'}°
              </span>
              <span className="text-title-md text-prius-slate font-medium">Playa Grande</span>
            </button>
            <div className="hidden sm:flex items-baseline gap-3">
              <span className="text-[44px] leading-none font-semibold text-black tracking-tighter tabular-nums">
                {actual.temperatura != null ? Math.round(actual.temperatura) : '--'}°
              </span>
              <span className="text-headline-sm text-prius-slate">Playa Grande</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-body-sm ${alerta ? 'bg-red-50 text-prius-error' : 'bg-prius-surface text-black'}`}>
              <ArrowUp size={14} style={{ transform: `rotate(${rotacionFlecha}deg)` }} />
              {alerta ? 'Viento fuerte' : 'Viento'} del {gradosARumbo(actual.direccion)}
            </div>
          </div>

          {/* Grilla de métricas reales (sin tile de agua/pleamar: no hay dato) */}
          <div className="grid grid-cols-3 gap-space-sm mt-space-md">
            <div className="p-space-sm sm:p-space-md rounded-xl bg-prius-surface flex flex-col justify-between">
              <div className="flex items-center justify-between text-prius-slate">
                <span className="text-label-md uppercase">Viento</span>
                <Wind size={16} />
              </div>
              <div className="mt-2">
                <span className="text-title-md sm:text-headline-md text-black tabular-nums">
                  {actual.viento != null ? Math.round(actual.viento) : '--'} <span className="text-body-sm font-normal text-prius-slate">km/h</span>
                </span>
              </div>
            </div>
            <div className="p-space-sm sm:p-space-md rounded-xl bg-prius-surface flex flex-col justify-between">
              <div className="flex items-center justify-between text-prius-slate">
                <span className="text-label-md uppercase">Ráfaga</span>
                <Gauge size={16} />
              </div>
              <div className="mt-2">
                <span className={`text-title-md sm:text-headline-md tabular-nums ${alerta ? 'text-prius-error' : 'text-black'}`}>
                  {Math.round(rafagaMax)} <span className="text-body-sm font-normal text-prius-slate">km/h</span>
                </span>
              </div>
            </div>
            <div className="p-space-sm sm:p-space-md rounded-xl bg-prius-surface flex flex-col justify-between">
              <div className="flex items-center justify-between text-prius-slate">
                <span className="text-label-md uppercase">Olas Mar</span>
                <Waves size={16} />
              </div>
              <div className="mt-2">
                <span className="text-title-md sm:text-headline-md text-black tabular-nums">
                  {actual.olaAltura != null ? Number(actual.olaAltura).toFixed(1) : '--'} <span className="text-body-sm font-normal text-prius-slate">m</span>
                </span>
              </div>
            </div>
          </div>

          {/* Tira horaria */}
          {proximasHoras.length > 0 && (
            <div className="mt-space-md pt-space-sm border-t border-hairline">
              <div className="flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
                {proximasHoras.map((h) => (
                  <div key={h.hora} className="flex-1 min-w-[48px] text-center py-1.5 px-1 rounded-lg bg-prius-surface">
                    <p className="text-label-md text-prius-slate">{h.hora.slice(0, 2)}h</p>
                    <Cloud size={16} className="text-prius-slate my-1 mx-auto" />
                    <p className="text-title-md text-black tabular-nums">{h.temperatura != null ? Math.round(h.temperatura) : '--'}°</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="sm:hidden mt-space-md h-9 rounded-xl bg-prius-surface text-black text-label-lg hover:bg-hairline transition-colors"
        >
          Ver pronóstico
        </button>
      </div>

      <ClimaPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} clima={clima} loading={loading} selectedDate={fecha} />
    </>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUp, Cloud, CloudRain, Droplets, ExternalLink, Gauge, Waves, Wind } from 'lucide-react'
import Modal from '../crm/Modal'
import { WINDGURU_SPOT_ID, UMBRAL_RAFAGA_ALERTA_KMH } from '../../config/clima'
import { resumenDiaClima } from '../../lib/clima'
import { formatFecha } from '../../lib/format'

const WINDGURU_URL = `https://www.windguru.cz/${WINDGURU_SPOT_ID}`

function MiniStat({ icon: Icon, label, value, sub, alerta }) {
  return (
    <div className={`rounded-2xl border p-4 ${alerta ? 'border-amber-500/40 bg-amber-500/[0.08]' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={alerta ? 'text-amber-300' : 'text-gray-400'} />
        <p className={`text-[9px] font-bold uppercase tracking-widest ${alerta ? 'text-amber-300' : 'text-gray-500'}`}>{label}</p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 tabular-nums mt-1">{sub}</p>}
    </div>
  )
}

/**
 * Modal de clima del día (oct 2026, rediseño) — reemplaza el panel lateral
 * angosto de la primera versión: ahora es un modal grande y centrado
 * (`Modal.jsx`, mismo mecanismo de overlay/Escape/click-afuera que el resto
 * de la app), bottom sheet de altura completa en mobile. Contenido:
 *  1. Hero con la lectura actual + grilla de mini-stats (viento, ráfaga,
 *     ola, lluvia).
 *  2. Tira hora por hora del día elegido, de la Edge Function `clima-playa`.
 *  3. Widget oficial de Windguru del spot fijo, cargado lazy recién al
 *     abrir — nunca en el render normal del Plano.
 *  4. Botón "Ver en Windguru" al sitio real, en pestaña nueva.
 *
 * Prohibido scrapear o pegarle a un endpoint interno de Windguru: el único
 * contacto con windguru.cz es este script de widget oficial + el link.
 */
export default function ClimaPanel({ isOpen, onClose, clima, loading, selectedDate }) {
  const overlayId = useId()
  const widgetContainerRef = useRef(null)
  const [widgetEstado, setWidgetEstado] = useState('idle') // idle | cargando | ok | error

  // Lazy: el script del widget solo se inserta cuando el panel está abierto,
  // y se saca del DOM al cerrar (si se reabre, se vuelve a pedir).
  useEffect(() => {
    if (!isOpen) return
    const el = widgetContainerRef.current
    if (!el) return
    el.innerHTML = ''
    setWidgetEstado('cargando')

    const uid = `wg_fwdg_${WINDGURU_SPOT_ID}_100_${overlayId.replace(/[^a-zA-Z0-9]/g, '')}`
    const holder = document.createElement('div')
    holder.id = uid
    el.appendChild(holder)

    const script = document.createElement('script')
    script.src = `https://www.windguru.cz/js/widget.php?s=${WINDGURU_SPOT_ID}&m=100&uid=${uid}`
    script.async = true
    script.onload = () => setWidgetEstado('ok')
    script.onerror = () => setWidgetEstado('error')
    el.appendChild(script)

    return () => { el.innerHTML = '' }
  }, [isOpen, overlayId])

  const resumen = resumenDiaClima(clima)
  const horas = clima?.disponible ? clima.horas : []
  const alerta = resumen ? Math.max(resumen.rafagaMax, resumen.vientoMax) >= UMBRAL_RAFAGA_ALERTA_KMH : false
  const lluvia = resumen && Number(resumen.actual.precipitacion) > 0.2
  const IconoHero = alerta ? Wind : lluvia ? CloudRain : Cloud

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clima del día" maxWidthClass="sm:max-w-2xl">
      <p className="text-xs text-gray-400 -mt-2">{formatFecha(selectedDate)} · Mar del Plata, Base Naval</p>

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}
          </div>
        </div>
      ) : !resumen ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <Cloud size={28} className="mx-auto text-gray-500 mb-3" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sin pronóstico para esta fecha</p>
          <p className="text-xs text-gray-500 mt-1">Open-Meteo solo cubre hoy + 14 días.</p>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className={`rounded-2xl border p-6 flex items-center gap-5 ${alerta ? 'border-amber-500/40 bg-amber-500/[0.08]' : 'border-white/10 bg-white/[0.04]'}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shrink-0 ${alerta ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
              <IconoHero size={30} className={alerta ? 'text-amber-300' : 'text-[#F2CA50]'} />
            </div>
            <div className="min-w-0">
              <p className="text-4xl font-bold text-white tabular-nums leading-none">
                {resumen.actual.temperatura != null ? Math.round(resumen.actual.temperatura) : '--'}°
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Sensación {resumen.actual.sensacion != null ? Math.round(resumen.actual.sensacion) : '--'}°
              </p>
              {alerta && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mt-2">Viento fuerte — precaución con sombrillas/carpas</p>
              )}
            </div>
          </div>

          {/* Mini-stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat
              icon={() => <ArrowUp size={14} style={{ transform: `rotate(${(Number(resumen.actual.direccion) || 0) + 180}deg)` }} />}
              label="Viento"
              value={`${resumen.actual.viento != null ? Math.round(resumen.actual.viento) : '--'} km/h`}
            />
            <MiniStat icon={Gauge} label="Ráfaga pico" value={`${Math.round(resumen.rafagaMax)} km/h`} alerta={alerta} />
            <MiniStat
              icon={Waves}
              label="Ola"
              value={resumen.actual.olaAltura != null ? `${Number(resumen.actual.olaAltura).toFixed(1)} m` : '--'}
              sub={resumen.actual.olaPeriodo != null ? `período ${Number(resumen.actual.olaPeriodo).toFixed(1)}s` : null}
            />
            <MiniStat icon={Droplets} label="Lluvia" value={`${Number(resumen.actual.precipitacion || 0).toFixed(1)} mm`} />
          </div>

          {/* Hora por hora */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hora por hora</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
              {horas.map((h) => (
                <div key={h.hora} className="shrink-0 w-[72px] text-center px-2 py-3 bg-white/[0.04] border border-white/10 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-500">{h.hora}</p>
                  <p className="text-base font-bold text-white mt-1 tabular-nums">{h.temperatura != null ? Math.round(h.temperatura) : '--'}°</p>
                  <p className="text-[10px] text-gray-400 mt-1 tabular-nums flex items-center justify-center gap-1">
                    <Wind size={10} /> {h.viento != null ? Math.round(h.viento) : '--'}
                  </p>
                  {h.olaAltura != null && (
                    <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums flex items-center justify-center gap-1">
                      <Waves size={10} /> {Number(h.olaAltura).toFixed(1)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Windguru */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Windguru — Mar del Plata, Base Naval</p>
        <div ref={widgetContainerRef} className="min-h-[140px] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/10" />
        {widgetEstado === 'error' && (
          <p className="text-xs text-gray-500">No se pudo cargar el widget de Windguru — usá el link de abajo.</p>
        )}
      </div>

      <a
        href={WINDGURU_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#FDE047] hover:bg-yellow-300 text-black transition-all flex items-center justify-center gap-2"
      >
        Ver en Windguru <ExternalLink size={14} />
      </a>
    </Modal>
  )
}

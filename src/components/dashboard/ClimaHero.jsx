import { useMemo, useState } from 'react'
import { ArrowUp, Cloud, ExternalLink } from 'lucide-react'
import { resumenDiaClima, gradosARumbo } from '../../lib/clima'
import { UMBRAL_RAFAGA_ALERTA_KMH, WINDGURU_SPOT_ID } from '../../config/clima'
import Card from '../brand/Card'
import ChartCard from '../brand/ChartCard'
import SegmentedControl from '../brand/SegmentedControl'
import { Topografia } from '../brand/patterns'
import ClimaPanel from './ClimaPanel'

const WINDGURU_URL = `https://www.windguru.cz/${WINDGURU_SPOT_ID}`

// Horario de playa que grafica la card; el detalle completo sigue en ClimaPanel.
const HORA_DESDE = '09:00'
const HORA_HASTA = '20:00'

const METRICAS = [
  { value: 'temperatura', label: 'Temperatura', format: (v) => `${Math.round(v)} °C` },
  { value: 'viento', label: 'Viento', format: (v) => `${Math.round(v)} km/h` },
  { value: 'olaAltura', label: 'Olas', format: (v) => `${Number(v).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m` },
]

// `clima`/`loading` ahora llegan por prop (B2, oct 2026): Home.jsx levantó
// el único `useClima(fecha)` para poder esperarlo junto con el resto de sus
// datos antes de mostrar nada (ver useInitialLoad) — dos llamadas separadas
// a este hook (acá y en Home) hubieran disparado el fetch a la Edge
// Function dos veces en paralelo. Mismo hook, misma Edge Function, cero
// cambio en su lógica/queries — solo cambió quién lo invoca.
export default function ClimaHero({ fecha, clima, loading }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [metrica, setMetrica] = useState('temperatura')
  const resumen = resumenDiaClima(clima)

  const horas = useMemo(
    () => (clima?.disponible ? clima.horas.filter((h) => h.hora >= HORA_DESDE && h.hora <= HORA_HASTA) : []),
    [clima],
  )
  const opciones = METRICAS.filter((m) => horas.some((h) => h[m.value] != null))

  if (loading) return <div className="card-surface card-pad h-[360px] animate-pulse" />

  if (!resumen || opciones.length === 0) {
    return (
      <Card title="Condiciones marítimas">
        <div className="flex items-center gap-3 text-ink-2">
          <Cloud size={20} strokeWidth={1.5} />
          <p className="text-label">Sin pronóstico para hoy.</p>
        </div>
      </Card>
    )
  }

  const { actual, rafagaMax, vientoMax } = resumen
  const alerta = Math.max(rafagaMax, vientoMax) >= UMBRAL_RAFAGA_ALERTA_KMH
  const rotacionFlecha = (Number(actual.direccion) || 0) + 180
  const seleccion = opciones.find((m) => m.value === metrica) || opciones[0]
  const serie = horas.map((h) => ({ x: h.hora, y: h[seleccion.value] }))
  const conDato = serie.filter((d) => d.y != null)
  const horaActual = conDato.findIndex((d) => d.x === actual.hora)

  return (
    <>
      <Card
        className="h-full relative overflow-hidden"
        title="Condiciones marítimas"
        action={
          <a href={WINDGURU_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost h-9 px-3 shrink-0">
            Windguru <ExternalLink size={16} strokeWidth={1.5} />
          </a>
        }
      >
        <Topografia opacity={0.03} />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <SegmentedControl label="Dato a graficar" options={opciones} value={seleccion.value} onChange={setMetrica} />
            <button type="button" onClick={() => setPanelOpen(true)} className="inline-flex items-center gap-2 text-label text-ink-2 hover:text-ink anim-colors">
              <ArrowUp size={16} strokeWidth={1.5} style={{ transform: `rotate(${rotacionFlecha}deg)` }} />
              {alerta ? 'Viento fuerte' : 'Viento'} del {gradosARumbo(actual.direccion)} · Ver pronóstico
            </button>
          </div>
          <ChartCard
            key={seleccion.value}
            data={serie}
            formatY={seleccion.format}
            activoInicial={horaActual >= 0 ? horaActual : Math.floor(conDato.length / 2)}
            descripcion={`${seleccion.label} por hora, de 9 a 20`}
          />
        </div>
      </Card>

      <ClimaPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} clima={clima} loading={loading} selectedDate={fecha} />
    </>
  )
}

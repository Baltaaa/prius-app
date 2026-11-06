import { CheckCircle2, MapPin } from 'lucide-react'
import UnidadLabel from '../crm/UnidadLabel'
import { formatFecha, formatHora, formatNombre, formatMonto, formatRangoFechas, formatCantidad } from '../../lib/format'

// Último check-in de hoy, leído de la base (codigos_reserva.checkin_at): al
// recargar la pantalla sigue ahí. La hora es la real del check-in.
function Dato({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-label text-ink-2">{label}</p>
      <div className="text-body text-ink">{children}</div>
    </div>
  )
}

export default function UltimoEscaneo({ grupo, onVerEnPlano }) {
  return (
    <section className="card-surface card-pad">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-card-title">Último escaneo</h2>
        {grupo && (
          <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-success-soft text-success-ink text-label font-semibold whitespace-nowrap">
            <CheckCircle2 size={14} strokeWidth={1.5} /> Check-in OK
          </span>
        )}
      </div>

      {!grupo ? (
        <p className="mt-3 text-label text-ink-2">Todavía no hubo check-ins hoy.</p>
      ) : (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <p className="text-row text-ink min-w-0 truncate" title={formatNombre(grupo.titular)}>{formatNombre(grupo.titular)}</p>
            <p className="text-label text-ink-2 tabular-nums whitespace-nowrap">{formatHora(grupo.ingresoAt)}</p>
          </div>
          <p className="font-mono text-label text-ink-2">{grupo.codigo}</p>

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
            <Dato label="Unidad">
              <span className="flex flex-wrap gap-x-3">
                {grupo.reservas.map((r) => <UnidadLabel key={r.id} tipo={r.unidades?.tipo} numero={r.unidades?.numero} />)}
              </span>
            </Dato>
            <Dato label="Período">
              {grupo.reservas[0].tipo_alquiler === 'dia'
                ? formatFecha(grupo.reservas[0].fecha)
                : formatRangoFechas(grupo.reservas[0].fecha_inicio, grupo.reservas[0].fecha_fin)}
            </Dato>
            <Dato label="Personas"><span className="tabular-nums">{formatCantidad(grupo.personas)}</span></Dato>
            <Dato label="Saldo">
              {grupo.sinVerificar
                ? <span className="text-ink-2">Sin verificar</span>
                : grupo.saldo > 0
                  ? <span className="text-danger-ink font-semibold tabular-nums whitespace-nowrap">{formatMonto(grupo.saldo).replace(/ /g, ' ')}</span>
                  : <span className="text-success-ink font-semibold">Saldado</span>}
            </Dato>
          </div>

          <button type="button" onClick={() => onVerEnPlano(grupo)} className="btn btn-secondary h-11 md:h-9 min-h-0 w-full md:w-auto md:px-4 mt-5 gap-2">
            <MapPin size={16} strokeWidth={1.5} /> Ver en plano
          </button>
        </>
      )}
    </section>
  )
}

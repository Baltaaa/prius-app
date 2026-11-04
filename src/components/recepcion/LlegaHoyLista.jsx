import { useState } from 'react'
import SegmentedControl from '../brand/SegmentedControl'
import UnidadLabel, { UnidadIcono } from '../crm/UnidadLabel'
import { filtrarLlegadas, FILTROS_LLEGADAS } from '../../lib/recepcion'
import { formatHora, formatNombre, formatPesos } from '../../lib/format'

// "Llegan hoy": una fila por reserva web (código) con el emoji de la unidad, el
// nombre, el código en mono, la unidad y el saldo. Pendiente → botón Check-in
// (abre la reserva en la tarjeta de cobro, que es donde se confirma); ya
// ingresado → "Ingresó" deshabilitado con la hora real del check-in. Nunca se
// muestra una hora de llegada que no exista en los datos.
export default function LlegaHoyLista({ items, onCheckin }) {
  const [filtro, setFiltro] = useState('todos')
  const visibles = filtrarLlegadas(items, filtro)

  return (
    <section className="card-surface overflow-hidden">
      <div className="card-pad pb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-title">Llegan hoy</h2>
        <SegmentedControl className="w-full md:w-auto" fullWidth="hasta-lg" label="Filtrar llegadas" options={FILTROS_LLEGADAS} value={filtro} onChange={setFiltro} />
      </div>

      {visibles.length === 0 ? (
        <p className="px-page md:px-card pb-card text-label text-ink-2">
          {items.length === 0 ? 'Nadie con reserva web para hoy.' : 'No hay reservas en este filtro.'}
        </p>
      ) : (
        <ul className="divide-y divide-divider border-t border-divider">
          {visibles.map((g) => (
            <li key={g.codigo} className="min-h-16 px-page md:px-card py-3 flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 rounded-icon bg-surface flex items-center justify-center text-card-title" aria-hidden>
                <UnidadIcono tipo={g.reservas[0].unidades?.tipo} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-row text-ink truncate" title={formatNombre(g.titular)}>{formatNombre(g.titular)}</p>
                <p className="text-label text-ink-2 flex flex-wrap items-center gap-x-2 min-w-0">
                  <span className="font-mono">{g.codigo}</span>
                  <span className="flex gap-2">
                    {g.reservas.map((r) => <UnidadLabel key={r.id} tipo={r.unidades?.tipo} numero={r.unidades?.numero} soloNumero />)}
                  </span>
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {g.sinVerificar ? (
                  <span className="text-label text-ink-2 whitespace-nowrap">Saldo sin verificar</span>
                ) : g.saldo > 0 ? (
                  <span className="text-label font-semibold text-danger-ink tabular-nums whitespace-nowrap">{formatPesos(g.saldo).replace(/ /g, ' ')}</span>
                ) : null}
                {g.ingresoAt ? (
                  <span className="inline-flex flex-col items-end">
                    <button type="button" disabled className="btn btn-secondary h-11 md:h-9 min-h-0 px-4 opacity-60 cursor-not-allowed">Ingresó</button>
                    <span className="text-label text-ink-2 tabular-nums mt-1">{formatHora(g.ingresoAt)}</span>
                  </span>
                ) : (
                  <button type="button" onClick={() => onCheckin(g.codigo)} className="btn btn-primary h-11 md:h-9 min-h-0 px-5">Check-in</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

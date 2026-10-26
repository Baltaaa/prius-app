import React, { useSyncExternalStore } from 'react'

// Antes se renderizaban SIEMPRE la tabla desktop Y las tarjetas mobile
// (con hidden md:block / md:hidden), ejecutando renderRow y renderMobileCard
// para cada fila y montando el doble de nodos DOM. Ahora solo se monta el
// layout que corresponde al ancho actual.

const query = '(min-width: 768px)'
const mql = typeof window !== 'undefined' ? window.matchMedia(query) : null

function subscribe(cb) {
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}

function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => mql?.matches ?? true, () => true)
}

// `columnWidths` (ítem 7, oct 2026, opcional — solo Reservas.jsx lo usa por
// ahora): un ancho CSS por header, mismo orden que `headers`. Con esto la
// tabla pasa a `table-fixed` y cada columna sin texto libre (fecha, unidad,
// montos, chips) queda en un ancho fijo que nunca rompe a dos líneas; la
// columna sin ancho en el array (ej. Cliente) se lleva todo el sobrante y
// es la única que puede wrappear. Sin esta prop, se comporta exactamente
// igual que antes (auto layout).
export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage, columnWidths }) {
  const isDesktop = useIsDesktop()

  if (!data || data.length === 0) {
    return (
      <div className="p-12 text-center text-sm tracking-wider text-prius-muted card-light rounded-xl">
        {emptyMessage || 'No se encontraron registros.'}
      </div>
    )
  }

  if (isDesktop || !renderMobileCard) {
    return (
      <div className="w-full">
        <div className="card-light rounded-xl overflow-x-auto card-light-inner">
          <table className={`w-full text-left border-collapse ${columnWidths ? 'table-fixed' : ''}`}>
            {columnWidths && (
              <colgroup>
                {headers.map((_, i) => (
                  <col key={i} style={columnWidths[i] ? { width: columnWidths[i] } : undefined} />
                ))}
              </colgroup>
            )}
            <thead>
              <tr className="border-b border-hairline text-[11px] font-bold uppercase tracking-widest text-prius-muted">
                {headers.map((h, i) => (
                  <th key={i} className={`font-semibold whitespace-nowrap ${columnWidths ? 'px-3 py-4' : 'px-6 py-4'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y divide-hairline text-prius-slate ${columnWidths ? 'text-xs' : 'text-sm'}`}>
              {data.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      {data.map((row, i) => (
        <div key={row.id ?? i} className="p-5 card-light rounded-xl flex flex-col gap-3">
          {renderMobileCard(row, i)}
        </div>
      ))}
    </div>
  )
}

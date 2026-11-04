import React, { useSyncExternalStore } from 'react'
import ScrollFade from '../ui/ScrollFade'

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
// `fillHeight` (mini-prompt 26/10/2026, solo Reservas/Clientes desktop por
// ahora): la tabla pasa a ocupar el 100% del alto de su contenedor padre
// (que a su vez ya viene con una altura fija vía flex-1/min-h-0 desde la
// página) y scrollea POR DENTRO con el encabezado sticky — en vez de que
// sea la página entera la que scrollee. Sin esta prop, altura automática
// por contenido, igual que siempre.
export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage, columnWidths, fillHeight }) {
  const isDesktop = useIsDesktop()

  if (!data || data.length === 0) {
    return (
      <div className={`text-center text-body text-ink-2 card-surface card-pad py-10 ${fillHeight ? 'lg:h-full' : ''}`}>
        {emptyMessage || 'No se encontraron registros.'}
      </div>
    )
  }

  if (isDesktop || !renderMobileCard) {
    return (
      <div className={`w-full ${fillHeight ? 'lg:h-full' : ''}`}>
        <div className={`card-surface ${fillHeight ? 'lg:h-full lg:flex lg:flex-col lg:overflow-hidden' : 'overflow-x-auto'}`}>
          <ScrollFade arriba={false} wrapperClassName={fillHeight ? 'lg:flex-1' : ''} className={fillHeight ? 'overflow-auto' : 'overflow-x-auto'}>
          <table className={`w-full text-left border-collapse ${columnWidths ? 'table-fixed' : ''}`}>
            {columnWidths && (
              <colgroup>
                {headers.map((_, i) => (
                  <col key={i} style={columnWidths[i] ? { width: columnWidths[i] } : undefined} />
                ))}
              </colgroup>
            )}
            <thead className={fillHeight ? 'lg:sticky lg:top-0 lg:z-10 bg-card' : undefined}>
              <tr className="border-b border-divider text-label text-ink-2">
                {headers.map((h, i) => (
                  <th key={i} className={`font-medium whitespace-nowrap h-12 ${columnWidths ? 'px-2' : 'px-6'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider text-body text-ink-2 ">
              {data.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
          </ScrollFade>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      {data.map((row, i) => (
        <div key={row.id ?? i} className="card-surface card-pad flex flex-col gap-3">
          {renderMobileCard(row, i)}
        </div>
      ))}
    </div>
  )
}

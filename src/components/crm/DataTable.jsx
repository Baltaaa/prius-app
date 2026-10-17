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

export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage }) {
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-bold uppercase tracking-widest text-prius-muted">
                {headers.map((h, i) => (
                  <th key={i} className="px-6 py-4 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-prius-slate">
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

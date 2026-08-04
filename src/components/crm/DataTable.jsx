import React from 'react'

export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-12 text-center text-sm tracking-wider text-gray-500 glass-card rounded-xl">
        {emptyMessage || 'No se encontraron registros.'}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block glass-card rounded-xl overflow-hidden glass-card-inner">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-widest text-gray-500">
              {headers.map((h, i) => (
                <th key={i} className="px-6 py-4 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-gray-300">
            {data.map((row, i) => renderRow(row, i))}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {data.map((row, i) => (
          <div key={i} className="p-5 glass-card rounded-xl flex flex-col gap-3">
            {renderMobileCard(row, i)}
          </div>
        ))}
      </div>
    </div>
  )
}
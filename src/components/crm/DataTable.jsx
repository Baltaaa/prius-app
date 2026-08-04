import React from 'react'

export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs tracking-wider text-white/40 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
        {emptyMessage || 'No se encontraron registros.'}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/60">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-xs text-white">
            {data.map((row, i) => renderRow(row, i))}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {data.map((row, i) => (
          <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md flex flex-col gap-2 text-white">
            {renderMobileCard(row, i)}
          </div>
        ))}
      </div>
    </div>
  )
}
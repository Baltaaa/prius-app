import React from 'react'

export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs tracking-wider text-neutral-400 bg-white border border-[#E5E5E5] rounded">
        {emptyMessage || 'No se encontraron registros.'}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto bg-white border border-[#E5E5E5] rounded">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5] text-[11px] font-bold uppercase tracking-wider text-neutral-600">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5] text-xs">
            {data.map((row, i) => renderRow(row, i))}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {data.map((row, i) => (
          <div key={i} className="p-4 bg-white border border-[#E5E5E5] rounded flex flex-col gap-2">
            {renderMobileCard(row, i)}
          </div>
        ))}
      </div>
    </div>
  )
}
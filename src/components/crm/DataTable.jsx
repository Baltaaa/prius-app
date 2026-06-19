import React from 'react'

export default function DataTable({ headers, data, renderRow, renderMobileCard, emptyMessage }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs uppercase tracking-wider text-neutral-400 bg-white border border-[#E5E5E5]">
        {emptyMessage || 'No se encontraron registros.'}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto bg-white border border-[#E5E5E5]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-white text-[9px] font-bold uppercase tracking-widest font-display">
              {headers.map((h, i) => (
                <th key={i} className="p-4 border-b border-[#E5E5E5] font-semibold">{h}</th>
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
          <div key={i} className="p-4 bg-white border border-[#E5E5E5] flex flex-col gap-2">
            {renderMobileCard(row, i)}
          </div>
        ))}
      </div>
    </div>
  )
}
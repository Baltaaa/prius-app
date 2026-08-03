import React from 'react'

export default function KpiCard({ title, value, subtitle, icon: Icon, highlight }) {
  return (
    <div className={`p-5 bg-white border border-[#E5E5E5] rounded flex flex-col justify-between h-32 ${highlight ? 'border-l-4 border-l-[#F2CA50]' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-500 tracking-tight">
          {title}
        </span>
        {Icon && (
          <div className={`w-8 h-8 rounded flex items-center justify-center ${highlight ? 'bg-[#F2CA50]/20 text-black' : 'bg-[#F9F9F9] text-neutral-500 border border-[#E5E5E5]'}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-black leading-none">{value}</div>
        {subtitle && (
          <p className="text-[11px] text-neutral-400 mt-1.5 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
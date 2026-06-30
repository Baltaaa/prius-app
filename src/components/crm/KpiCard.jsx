import React from 'react'

export default function KpiCard({ title, value, subtitle, icon: Icon, highlight }) {
  return (
    <div className={`p-6 border border-[#E5E5E5] bg-white transition-all rounded-sm flex flex-col justify-between h-[130px] ${highlight ? 'border-l-4 border-l-[#F2CA50]' : ''}`}>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 font-display">
            {title}
          </span>
          {Icon && <Icon className={`w-4 h-4 ${highlight ? 'text-[#F2CA50]' : 'text-neutral-400'}`} />}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-sans text-black leading-none">{value}</span>
        </div>
      </div>
      {subtitle && (
        <p className="text-[9px] uppercase tracking-wider text-neutral-500 mt-2 font-display truncate">
          {subtitle}
        </p>
      )}
    </div>
  )
}
import React from 'react'

export default function KpiCard({ title, value, subtitle, icon: Icon, highlight }) {
  return (
    <div className={`p-6 border border-[#E5E5E5] bg-white transition-all ${highlight ? 'border-l-4 border-l-[#F2CA50]' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-display">
          {title}
        </span>
        {Icon && <Icon className={`w-4 h-4 ${highlight ? 'text-[#F2CA50]' : 'text-neutral-400'}`} />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-sans text-black leading-none">{value}</span>
      </div>
      {subtitle && (
        <p className="text-[9px] uppercase tracking-wider text-neutral-500 mt-1 font-display">
          {subtitle}
        </p>
      )}
    </div>
  )
}
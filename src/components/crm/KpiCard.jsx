import React from 'react'

export default function KpiCard({ title, value, subtitle, icon: Icon, highlight }) {
  return (
    <div className="glass-card p-6 flex flex-col justify-between h-40 glass-card-inner relative overflow-hidden group">
      {/* Background Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#FDE047]/30 transition-colors">
          {Icon && <Icon size={20} className={highlight ? 'text-[#FDE047]' : 'text-gray-400'} />}
        </div>
        <span className="text-sm font-medium text-gray-300 uppercase tracking-wider text-[11px]">{title}</span>
      </div>

      <div className="relative z-10">
        <div className="text-3xl font-bold text-[#FDE047] tracking-tight">{value}</div>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-1 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* Decorative line */}
      <div className="absolute bottom-4 left-6 right-6 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${highlight ? 'bg-[#FDE047]/40 w-1/3' : 'bg-gray-700/50 w-1/4'}`} />
      </div>
    </div>
  )
}
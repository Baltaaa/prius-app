import React from 'react'

// Barra de progreso real y reutilizable: ancho = value/max, nunca inventada.
// Si el llamador no puede calcular un "max" honesto para una métrica, no debe
// pasar `progress` — la tarjeta simplemente no muestra barra en vez de un
// número de relleno.
export default function KpiCard({ title, value, subtitle, icon: Icon, highlight, progress }) {
  const pct = progress ? Math.min(100, Math.max(0, (Number(progress.value) / Number(progress.max)) * 100)) : null

  return (
    <div className="card-light p-4 sm:p-6 flex flex-col justify-between h-32 sm:h-40 card-light-inner relative overflow-hidden group min-w-0">
      {/* Background Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10 min-w-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-prius-subtle flex items-center justify-center border border-hairline group-hover:border-gold/30 transition-colors shrink-0">
          {Icon && <Icon size={18} className={highlight ? 'text-gold' : 'text-prius-slate'} />}
        </div>
        {/* Nunca en dos líneas: en mobile el título achica en vez de envolver
            (2 columnas dejan poco ancho — ver CLAUDE.md "Mobile-first"). */}
        <span className="text-[11px] font-medium text-prius-slate uppercase tracking-wider truncate min-w-0">{title}</span>
      </div>

      <div className="relative z-10 min-w-0">
        <div className="text-xl sm:text-3xl font-bold text-gold tracking-tight truncate">{value}</div>
        {subtitle && (
          <p className="text-[11px] text-prius-muted mt-1 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* Barra de progreso: solo se pinta si vino un criterio real (progress) */}
      {pct !== null && (
        <div className="absolute bottom-3 sm:bottom-4 left-4 right-4 sm:left-6 sm:right-6 h-1 bg-prius-subtle rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${highlight ? 'bg-gold' : 'bg-gray-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

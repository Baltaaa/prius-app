import React from 'react'

// Fila de actividad estilo fintech: ícono avatar 40px + título/subtítulo +
// monto/estado a la derecha. Separador hairline inferior (sin usar si va
// dentro de una Card con divide-y).
export default function ListItem({ icon: Icon, title, subtitle, trailing, trailingSub, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 border-b border-hairline last:border-b-0 ${onClick ? 'cursor-pointer hover:bg-prius-subtle -mx-2 px-2 rounded-xl transition-colors' : ''} ${className}`}
    >
      {Icon && (
        <div className="w-10 h-10 shrink-0 rounded-xl bg-prius-subtle flex items-center justify-center">
          <Icon size={18} className="text-black" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-title-md text-black truncate">{title}</p>
        {subtitle && <p className="text-body-sm text-prius-slate truncate">{subtitle}</p>}
      </div>
      {(trailing || trailingSub) && (
        <div className="text-right shrink-0">
          {trailing && <p className="text-title-md text-black tabular-nums">{trailing}</p>}
          {trailingSub && <p className="text-body-sm text-prius-slate">{trailingSub}</p>}
        </div>
      )}
    </div>
  )
}

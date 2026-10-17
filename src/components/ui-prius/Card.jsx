import React from 'react'

// Card grande (KPI, módulo): rounded-2xl, borde hairline, sin sombra.
export function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white border border-hairline rounded-2xl ${className}`} {...props}>
      {children}
    </div>
  )
}

// Card chica (fila de reserva, input, botón contenedor): rounded-xl.
export function CardSm({ className = '', children, ...props }) {
  return (
    <div className={`bg-white border border-hairline rounded-xl ${className}`} {...props}>
      {children}
    </div>
  )
}

// KPI Stat Card: label uppercase + métrica grande + trend opcional.
export function StatCard({ label, value, trend, trendTone = 'success', className = '', onClick }) {
  const trendColor = trendTone === 'error' ? 'text-prius-error' : trendTone === 'warning' ? 'text-prius-warning' : 'text-prius-success'
  return (
    <Card
      className={`p-5 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:bg-prius-subtle transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      <span className="text-label-md uppercase tracking-wider text-prius-slate">{label}</span>
      <span className="text-metric-xl text-black tabular-nums">{value}</span>
      {trend && (
        <span className={`inline-flex w-fit px-1.5 py-0.5 rounded-full bg-prius-subtle text-body-sm font-semibold ${trendColor}`}>
          {trend}
        </span>
      )}
    </Card>
  )
}

export default Card

import { TIPO_COMPROBANTE_GASTO_LABEL } from '../../lib/caja'

// Badge único de tipo de comprobante de un egreso (nov 2026).
//
// F = con factura, en amarillo Prius (es el gasto que la contadora puede
// computar); SF = sin factura, en neutro. Lo comparten la lista en vivo de
// Caja, el detalle del gasto, el resumen de cierre y Reportes — un mismo
// estado, un mismo color en toda la app.
export default function BadgeFactura({ tipo, className = '' }) {
  if (!tipo) return null
  const esF = tipo === 'F'
  return (
    <span
      title={TIPO_COMPROBANTE_GASTO_LABEL[tipo] || tipo}
      className={`inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded-full text-[12px] font-semibold tabular-nums shrink-0 ${
        esF ? 'bg-gold-100 text-ink border border-gold-300' : 'bg-surface text-ink-2 border border-line'
      } ${className}`}
    >
      {tipo}
    </span>
  )
}

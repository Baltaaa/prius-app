import { formatPesos } from '../../lib/format'

// Componente único de monto para cards/resúmenes de stats (pulido mobile
// iPhone, oct 2026) — el "$" nunca se separa del número (whitespace-nowrap)
// y el tamaño es fluido con clamp() para que montos largos como
// $ 239.947.560 entren en una sola línea incluso en 375px. tabular-nums
// para que los dígitos no "bailen" de ancho entre refrescos. Antes cada
// card de stats usaba text-2xl/text-sm sueltos sin clamp — eso partía los
// montos largos en dos renglones en mobile angosto.
//
// `size="lg"` (default): el stat "hero" de una pantalla — reusa
// text-metric-xl (clamp(22px,6vw,34px), tailwind.config.js), igual que ya
// usaba la card "Neto en caja" de Caja.jsx.
// `size="md"`: cards KPI secundarias — clamp(18px,5vw,24px), tope en 24px
// para calzar EXACTO con el text-2xl fijo que usaban en desktop (nada
// cambia ahí), y se achica solo por debajo de ~480px de ancho para no
// partirse en dos líneas.
const SIZE_CLASS = {
  lg: 'text-metric-xl',
  md: 'text-[clamp(18px,5vw,24px)] font-bold leading-tight',
}

export default function MontoStat({ value, size = 'lg', className = '', as: Tag = 'p' }) {
  return (
    <Tag className={`${SIZE_CLASS[size] || SIZE_CLASS.lg} tabular-nums whitespace-nowrap ${className}`}>
      {formatPesos(value)}
    </Tag>
  )
}

import { Banknote, Landmark, QrCode, CreditCard } from 'lucide-react'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_LABEL_CORTO } from '../../lib/pagos'
import MontoStat from '../ui/MontoStat'

const MEDIO_ICONO = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercado_pago: QrCode,
  tarjeta_debito: CreditCard,
  tarjeta_credito: CreditCard,
}

// Fila del desglose por medio de pago (Caja abierta, cerrada y resumen): ícono
// a la izquierda, etiqueta corta arriba y monto completo abajo, en dos líneas.
// MontoStat no parte el "$" del número (nowrap + espacio no separable). El
// nombre completo del medio queda en el `title`.
export default function FilaMedioPago({ medio, monto, fmt, detalle, negativo = false }) {
  const Icono = MEDIO_ICONO[medio] || Banknote
  return (
    <div className="bg-surface rounded-inner p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-icon bg-card flex items-center justify-center text-ink-2 shrink-0">
        <Icono size={18} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-label text-ink-2" title={MEDIO_PAGO_LABEL[medio] || medio}>{MEDIO_PAGO_LABEL_CORTO[medio] || medio}</span>
        <MontoStat as="span" size="md" value={monto} fmt={fmt} className={`block ${negativo ? 'text-danger' : 'text-ink'}`} />
        {detalle && <span className="block text-label text-ink-2 mt-1">{detalle}</span>}
      </div>
    </div>
  )
}

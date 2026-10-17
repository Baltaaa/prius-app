import { useState } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import LoadingButton from '../ui/LoadingButton'
import { Wallet } from 'lucide-react'

// Cartelito proactivo (oct 2026): la caja ya se auto-crea sola en $0 con el
// primer cobro/gasto del día (fn_resolver_caja_id) — un pago NUNCA se
// bloquea por esto. Este botón solo marca explícitamente abierta_por/
// abierta_at para un día que todavía no tuvo ningún movimiento, no pide
// monto inicial (no existe ese concepto).
export default function AvisoCajaCerrada({ onAbierta, className = '' }) {
  const { iniciarCaja } = useData()
  const { alert } = useDialog()
  const [saving, setSaving] = useState(false)

  const handleAbrir = async () => {
    setSaving(true)
    try {
      await iniciarCaja()
      onAbierta?.()
    } catch (err) {
      await alert(err.message || 'No se pudo abrir la caja.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`p-4 bg-gold/5 border border-gold/20 rounded-xl space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <Wallet className="text-gold shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-prius-slate">
          Todavía no hubo movimientos en la caja de hoy. Empieza en $0 con el primer cobro o gasto.
        </p>
      </div>
      <LoadingButton
        loading={saving}
        loadingText="Abriendo..."
        onClick={handleAbrir}
        className="w-full py-2.5 min-h-[44px] rounded-lg text-[10px] font-bold uppercase tracking-widest bg-gold text-black hover:bg-yellow-300"
      >
        Abrir caja
      </LoadingButton>
    </div>
  )
}

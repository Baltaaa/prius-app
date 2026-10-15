import { useState } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import MoneyInput from '../inputs/MoneyInput'
import { Wallet } from 'lucide-react'

// Cartelito proactivo (oct 2026): antes, "caja cerrada" solo se enteraba el
// usuario DESPUÉS de intentar cobrar (error P0003 del RPC, ver
// RegistrarPago.jsx `esperandoCaja`). Este componente se muestra ANTES,
// apenas se abre cualquier flujo de dinero en vivo (cobro de hoy en
// Clientes/Reservas/Plano, cobro en Recepción) si no hay una caja abierta
// hoy — sugiere abrirla ahí mismo, sin perder lo que ya se cargó en el
// formulario de atrás. Un pago con fecha histórica (anterior al 1/10) nunca
// la necesita — el llamador decide cuándo mostrarlo.
export default function AvisoCajaCerrada({ onAbierta, className = '' }) {
  const { iniciarCaja } = useData()
  const { alert } = useDialog()
  const [abriendo, setAbriendo] = useState(false)
  const [montoApertura, setMontoApertura] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleAbrir = async () => {
    setSaving(true)
    try {
      await iniciarCaja(montoApertura || 0)
      setAbriendo(false)
      onAbierta?.()
    } catch (err) {
      await alert(err.message || 'No se pudo abrir la caja.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`p-4 bg-[#FDE047]/5 border border-[#FDE047]/20 rounded-xl space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <Wallet className="text-[#FDE047] shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-gray-300">
          No hay una caja abierta hoy. Para cobros de hoy hace falta la caja abierta — podés abrirla ahora sin perder lo que cargaste acá.
        </p>
      </div>
      {!abriendo ? (
        <button
          type="button"
          onClick={() => setAbriendo(true)}
          className="w-full py-2.5 min-h-[44px] rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#FDE047] text-black hover:bg-yellow-300 transition-all"
        >
          Abrir caja
        </button>
      ) : (
        <div className="space-y-2">
          <MoneyInput label="Monto inicial de caja" value={montoApertura} onChange={setMontoApertura} max={10_000_000} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbriendo(false)}
              className="flex-1 py-2.5 min-h-[44px] rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleAbrir}
              className="flex-1 py-2.5 min-h-[44px] rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#FDE047] text-black hover:bg-yellow-300 disabled:opacity-50 transition-all"
            >
              {saving ? 'Abriendo...' : 'Confirmar apertura'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import Modal from './Modal'
import MoneyInput from '../inputs/MoneyInput'
import TextInput from '../inputs/TextInput'
import BrandSelect from '../ui/BrandSelect'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_EMOJI } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL, CATEGORIA_GASTO_EMOJI } from '../../lib/caja'
import LoadingButton from '../ui/LoadingButton'

// 31/10/2026: mismo lenguaje visual que Registrar Pago — BrandSelect con
// emoji por opción en vez de SelectChips sin ícono. Los emojis salen de los
// módulos únicos (lib/pagos, lib/caja), no hardcodeados acá.
const MEDIO_OPTIONS = Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({
  value, label: `${MEDIO_PAGO_EMOJI[value] || ''} ${label}`.trim(),
}))
const CATEGORIA_OPTIONS = Object.entries(CATEGORIA_GASTO_LABEL).map(([value, label]) => ({
  value, label: `${CATEGORIA_GASTO_EMOJI[value] || ''} ${label}`.trim(),
}))

// Único punto de alta de egresos (Tarea 5) — es lo único de dinero que se
// carga desde Caja. FAB en mobile / botón primario en desktop, ver Caja.jsx.
export default function RegistrarGasto({ isOpen, onClose }) {
  const { registrarGasto } = useData()
  const { toast } = useDialog()

  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState('otros')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [monto, setMonto] = useState(null)
  const [proveedor, setProveedor] = useState('')
  const [comprobanteProveedor, setComprobanteProveedor] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setConcepto(''); setCategoria('otros'); setMedioPago('efectivo')
    setMonto(null); setProveedor(''); setComprobanteProveedor('')
  }, [isOpen])

  const conceptoValido = concepto.trim().length >= 3 && concepto.trim().length <= 120
  const montoValido = monto != null && monto > 0 && monto <= 100_000_000

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!conceptoValido || !montoValido) return
    setSaving(true)
    try {
      await registrarGasto({ concepto: concepto.trim(), categoria, medioPago, monto, proveedor: proveedor || null, comprobanteProveedor: comprobanteProveedor || null })
      onClose()
      toast('Gasto registrado con éxito', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo registrar el gasto.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Gasto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <TextInput
          label="Concepto"
          required
          value={concepto}
          onChange={setConcepto}
          maxLength={120}
          placeholder="Ej. Compra de hielo"
          error={concepto && !conceptoValido ? 'Entre 3 y 120 caracteres' : undefined}
        />

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Categoría</label>
          <BrandSelect value={categoria} onChange={setCategoria} options={CATEGORIA_OPTIONS} />
        </div>

        <MoneyInput label="Monto" required value={monto} onChange={setMonto} max={100_000_000} />

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Medio de pago</label>
          <BrandSelect value={medioPago} onChange={setMedioPago} options={MEDIO_OPTIONS} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextInput label="Proveedor (opcional)" value={proveedor} onChange={setProveedor} maxLength={80} />
          <TextInput label="Comprobante (opcional)" value={comprobanteProveedor} onChange={setComprobanteProveedor} maxLength={80} />
        </div>

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Registrando..."
          disabled={!conceptoValido || !montoValido}
          className="w-full py-4 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs shadow-xl"
        >
          Registrar Gasto
        </LoadingButton>
      </form>
    </Modal>
  )
}

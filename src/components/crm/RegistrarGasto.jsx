import { useState, useEffect } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import Modal from './Modal'
import MoneyInput from '../inputs/MoneyInput'
import TextInput from '../inputs/TextInput'
import SelectChips from '../inputs/SelectChips'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL } from '../../lib/caja'

const MEDIO_OPTIONS = Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({ value, label }))
const CATEGORIA_OPTIONS = Object.entries(CATEGORIA_GASTO_LABEL).map(([value, label]) => ({ value, label }))

// Único punto de alta de egresos (Tarea 5) — es lo único de dinero que se
// carga desde Caja. FAB en mobile / botón primario en desktop, ver Caja.jsx.
export default function RegistrarGasto({ isOpen, onClose }) {
  const { registrarGasto } = useData()
  const { alert } = useDialog()

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
    } catch (err) {
      await alert(err.message || 'No se pudo registrar el gasto.')
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

        <SelectChips label="Categoría" options={CATEGORIA_OPTIONS} value={categoria} onChange={setCategoria} required />

        <MoneyInput label="Monto" required value={monto} onChange={setMonto} max={100_000_000} />

        <SelectChips label="Medio de pago" options={MEDIO_OPTIONS} value={medioPago} onChange={setMedioPago} required />

        <div className="grid grid-cols-2 gap-4">
          <TextInput label="Proveedor (opcional)" value={proveedor} onChange={setProveedor} maxLength={80} />
          <TextInput label="Comprobante (opcional)" value={comprobanteProveedor} onChange={setComprobanteProveedor} maxLength={80} />
        </div>

        <button
          type="submit"
          disabled={saving || !conceptoValido || !montoValido}
          className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
        >
          {saving ? 'Registrando...' : 'Registrar Gasto'}
        </button>
      </form>
    </Modal>
  )
}

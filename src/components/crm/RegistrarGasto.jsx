import { useState, useEffect, useMemo, useId } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { useRevealOnCheck } from '../../hooks/useRevealOnCheck'
import Modal from './Modal'
import MoneyInput from '../inputs/MoneyInput'
import TextInput from '../inputs/TextInput'
import BrandSelect from '../ui/BrandSelect'
import SegmentedControl from '../brand/SegmentedControl'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_EMOJI } from '../../lib/pagos'
import { CATEGORIA_GASTO_EMOJI } from '../../lib/caja'
import LoadingButton from '../ui/LoadingButton'

// 31/10/2026: mismo lenguaje visual que Registrar Pago — BrandSelect con
// emoji por opción en vez de SelectChips sin ícono. Los emojis salen de los
// módulos únicos (lib/pagos, lib/caja), no hardcodeados acá.
const MEDIO_OPTIONS = Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({
  value, label: `${MEDIO_PAGO_EMOJI[value] || ''} ${label}`.trim(),
}))

// Nov 2026, pedido del dueño: todo egreso se clasifica con factura / sin
// factura. No hay valor por defecto a propósito — es el dato que la contadora
// necesita bien cargado, así que se elige a mano y hasta entonces no se puede
// guardar.
const TIPO_OPTIONS = [
  { value: 'F', label: 'F · Con factura' },
  { value: 'SF', label: 'SF · Sin factura' },
]

const LETRA_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

// Único punto de alta de egresos (Tarea 5) — es lo único de dinero que se
// carga desde Caja. FAB en mobile / botón primario en desktop, ver Caja.jsx.
export default function RegistrarGasto({ isOpen, onClose }) {
  const { registrarGasto, categoriasGasto, todosGastos } = useData()
  const { toast } = useDialog()
  const listaProveedoresId = useId()

  const [concepto, setConcepto] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [tipoComprobante, setTipoComprobante] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [monto, setMonto] = useState(null)
  const [proveedor, setProveedor] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [letraFactura, setLetraFactura] = useState('')
  const [saving, setSaving] = useState(false)

  // Solo las categorías activas se pueden elegir: una desactivada sigue
  // existiendo en los gastos viejos, pero no se ofrece más.
  const categoriaOptions = useMemo(
    () => (categoriasGasto || [])
      .filter((c) => c.activa)
      .map((c) => ({ value: c.id, label: `${CATEGORIA_GASTO_EMOJI[c.slug] || '📌'} ${c.nombre}` })),
    [categoriasGasto],
  )

  // Autocompletado de proveedores ya usados: se arma con los gastos que ya
  // están en memoria, sin un viaje extra al server.
  const proveedoresUsados = useMemo(() => {
    const vistos = new Map()
    for (const g of todosGastos || []) {
      const nombre = (g.proveedor || '').trim()
      if (!nombre) continue
      const clave = nombre.toLowerCase()
      if (!vistos.has(clave)) vistos.set(clave, nombre)
    }
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
  }, [todosGastos])

  const esF = tipoComprobante === 'F'
  const facturaRef = useRevealOnCheck(esF)

  useEffect(() => {
    if (!isOpen) return
    setConcepto(''); setCategoriaId(''); setTipoComprobante(''); setMedioPago('efectivo')
    setMonto(null); setProveedor(''); setNumeroFactura(''); setLetraFactura('')
  }, [isOpen])

  // Al pasar a SF los datos de factura se descartan: no se guardan, así que
  // tampoco quedan escondidos en el form esperando a que alguien vuelva a F.
  useEffect(() => {
    if (tipoComprobante === 'SF') { setNumeroFactura(''); setLetraFactura('') }
  }, [tipoComprobante])

  const conceptoValido = concepto.trim().length >= 3 && concepto.trim().length <= 120
  const montoValido = monto != null && monto > 0 && monto <= 100_000_000
  const proveedorValido = !esF || proveedor.trim().length > 0
  const puedeGuardar = conceptoValido && montoValido && !!categoriaId && !!tipoComprobante && proveedorValido

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!puedeGuardar) return
    setSaving(true)
    try {
      await registrarGasto({
        concepto: concepto.trim(),
        categoriaId,
        medioPago,
        monto,
        tipoComprobante,
        proveedor: proveedor.trim() || null,
        numeroFactura: esF ? (numeroFactura.trim() || null) : null,
        letraFactura: esF ? (letraFactura || null) : null,
      })
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
        {/* Primero el tipo: define qué campos hacen falta más abajo. */}
        <div className="space-y-2">
          <label className="text-label text-ink-2">Tipo de comprobante *</label>
          <SegmentedControl
            label="Tipo de comprobante"
            options={TIPO_OPTIONS}
            value={tipoComprobante}
            onChange={setTipoComprobante}
            fullWidth
          />
          {!tipoComprobante && (
            <p className="text-label text-ink-2">Elegí si el gasto tiene factura para poder guardarlo.</p>
          )}
        </div>

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
          <label className="text-label text-ink-2">Categoría *</label>
          <BrandSelect
            value={categoriaId}
            onChange={setCategoriaId}
            options={categoriaOptions}
            placeholder="Elegí una categoría"
          />
        </div>

        <MoneyInput label="Monto" required value={monto} onChange={setMonto} max={100_000_000} />

        <div className="space-y-2">
          <label className="text-label text-ink-2">Medio de pago</label>
          <BrandSelect value={medioPago} onChange={setMedioPago} options={MEDIO_OPTIONS} />
        </div>

        {/* Proveedor: obligatorio con factura, opcional sin factura. El
            datalist autocompleta con los proveedores que ya se usaron. */}
        <div>
          <TextInput
            label={esF ? 'Proveedor' : 'Proveedor (opcional)'}
            value={proveedor}
            onChange={setProveedor}
            maxLength={80}
            required={esF}
            placeholder="Ej. Distribuidora del Sur"
            list={listaProveedoresId}
          />
          {proveedoresUsados.length > 0 && (
            <datalist id={listaProveedoresId}>
              {proveedoresUsados.map((p) => <option key={p} value={p} />)}
            </datalist>
          )}
        </div>

        {esF && (
          <div ref={facturaRef} className="animate-premium-fade grid grid-cols-[1fr_auto] gap-4 items-start">
            <TextInput
              label="N° de factura (opcional)"
              value={numeroFactura}
              onChange={setNumeroFactura}
              maxLength={40}
              placeholder="Ej. 0001-00001234"
            />
            <div className="space-y-2 w-28">
              <label className="text-label text-ink-2">Letra</label>
              <BrandSelect
                value={letraFactura}
                onChange={setLetraFactura}
                options={LETRA_OPTIONS}
                placeholder="—"
              />
            </div>
          </div>
        )}

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Registrando..."
          disabled={!puedeGuardar}
          className="text-label w-full py-4 bg-ink hover:bg-chart-2 rounded-full text-on-ink"
        >
          Registrar Gasto
        </LoadingButton>
      </form>
    </Modal>
  )
}

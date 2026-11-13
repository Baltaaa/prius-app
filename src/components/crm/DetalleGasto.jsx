import { useState, useEffect, useMemo } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { formatMonto, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL, CATEGORIA_GASTO_EMOJI, TIPO_COMPROBANTE_GASTO_LABEL } from '../../lib/caja'
import Modal from './Modal'
import BadgeFactura from './BadgeFactura'
import ConfirmarSuperadminModal from './ConfirmarSuperadminModal'
import TextInput from '../inputs/TextInput'
import BrandSelect from '../ui/BrandSelect'
import SegmentedControl from '../brand/SegmentedControl'
import { AlertTriangle, Pencil } from 'lucide-react'

const inputClass =
  'w-full bg-surface rounded-inner px-4 py-3 text-ink text-base md:text-body outline-none font-semibold resize-none border border-transparent focus:ring-2 focus:ring-gold'

const TIPO_OPTIONS = [
  { value: 'F', label: 'F · Con factura' },
  { value: 'SF', label: 'SF · Sin factura' },
]
const LETRA_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

// Detalle de un gasto ya registrado (Tarea 5) — mismo patrón que DetallePago:
// ver datos y anular con motivo obligatorio (solo si la caja sigue abierta).
//
// Nov 2026: el superadmin puede además CORREGIR el tipo (F/SF), la categoría,
// el proveedor y los datos de factura, aunque la caja esté cerrada — misma
// regla que la corrección de comprobantes de pagos: la caja lee los gastos en
// vivo, así que el cierre, el A4, el CSV y Reportes se actualizan solos y el
// "contado" del arqueo no se toca. Va con contraseña y queda en Historial.
export default function DetalleGasto({ isOpen, onClose, gasto }) {
  const { anularGasto, editarGasto, categoriasGasto } = useData()
  const { alert, toast } = useDialog()
  const puedeCorregir = usePermiso('editar_gasto')

  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState('SF')
  const [categoriaId, setCategoriaId] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [letraFactura, setLetraFactura] = useState('')
  const [confirmarEditar, setConfirmarEditar] = useState(false)

  const categoriaOptions = useMemo(
    () => (categoriasGasto || [])
      // Una categoría desactivada no se ofrece, salvo que sea justo la que
      // tiene este gasto (si no, el select no podría mostrar su valor).
      .filter((c) => c.activa || c.id === gasto?.categoria_id)
      .map((c) => ({ value: c.id, label: `${CATEGORIA_GASTO_EMOJI[c.slug] || '📌'} ${c.nombre}` })),
    [categoriasGasto, gasto?.categoria_id],
  )

  const nombreCategoria = useMemo(() => {
    const cat = (categoriasGasto || []).find((c) => c.id === gasto?.categoria_id)
    return cat?.nombre || CATEGORIA_GASTO_LABEL[gasto?.categoria] || gasto?.categoria || '—'
  }, [categoriasGasto, gasto?.categoria_id, gasto?.categoria])

  useEffect(() => {
    if (!isOpen) return
    setAnulando(false)
    setMotivo('')
    setEditando(false)
    setTipo(gasto?.tipo_comprobante || 'SF')
    setCategoriaId(gasto?.categoria_id || '')
    setProveedor(gasto?.proveedor || '')
    setNumeroFactura(gasto?.comprobante_proveedor || '')
    setLetraFactura(gasto?.letra_factura || '')
  }, [isOpen, gasto?.id, gasto?.tipo_comprobante, gasto?.categoria_id, gasto?.proveedor, gasto?.comprobante_proveedor, gasto?.letra_factura])

  if (!gasto) return null

  const esF = tipo === 'F'
  const puedeGuardarEdicion = !!categoriaId && !!tipo && (!esF || proveedor.trim().length > 0)

  const handleAnular = async () => {
    if (!motivo.trim()) return
    setSaving(true)
    try {
      await anularGasto(gasto.id, motivo.trim())
      onClose()
    } catch (err) {
      await alert(err.message || 'No se pudo anular el gasto.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmEditar = async (password) => {
    await editarGasto({
      gastoId: gasto.id,
      categoriaId,
      tipoComprobante: tipo,
      proveedor: proveedor.trim(),
      numeroFactura: esF ? numeroFactura.trim() : null,
      letraFactura: esF ? letraFactura : null,
    }, password)
    setConfirmarEditar(false)
    setEditando(false)
    toast('Gasto corregido', { tone: 'success' })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Gasto">
      <div className="space-y-6">
        {gasto.estado === 'anulado' && (
          <div className="flex items-start gap-3 p-4 bg-danger-soft border border-danger/30 rounded-inner">
            <AlertTriangle className="text-danger shrink-0 mt-1" size={18} />
            <div>
              <p className="text-label text-danger">Gasto anulado</p>
              <p className="text-label text-ink-2 mt-1">{gasto.anulado_motivo}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-label text-ink-2">Concepto</p>
              <p className="text-body font-semibold text-ink mt-1">{gasto.descripcion}</p>
            </div>
            <BadgeFactura tipo={gasto.tipo_comprobante} className="mt-5" />
          </div>
          <div>
            <p className="text-label text-ink-2">Monto</p>
            <p className={`text-card-title mt-1 ${gasto.estado === 'anulado' ? 'text-ink-2 line-through' : 'text-danger'}`}>
              {formatMonto(gasto.monto)}
            </p>
          </div>
          <div>
            <p className="text-label text-ink-2">Categoría</p>
            <p className="text-body text-ink mt-1">{nombreCategoria}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Medio de pago</p>
            <p className="text-body text-ink mt-1">{MEDIO_PAGO_LABEL[gasto.medio_pago] || gasto.medio_pago}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Fecha</p>
            <p className="text-body text-ink mt-1">{formatFecha(gasto.created_at)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-label text-ink-2">Comprobante</p>
            <p className="text-body text-ink mt-1">
              {TIPO_COMPROBANTE_GASTO_LABEL[gasto.tipo_comprobante] || gasto.tipo_comprobante}
              {gasto.tipo_comprobante === 'F' && (gasto.letra_factura || gasto.comprobante_proveedor)
                ? ` · ${[gasto.letra_factura, gasto.comprobante_proveedor].filter(Boolean).join(' ')}`
                : ''}
            </p>
          </div>
          {gasto.proveedor && (
            <div className="col-span-2">
              <p className="text-label text-ink-2">Proveedor</p>
              <p className="text-body text-ink mt-1">{gasto.proveedor}</p>
            </div>
          )}
        </div>

        {/* Corrección de superadmin: anda con la caja abierta o cerrada. */}
        {gasto.estado === 'vigente' && puedeCorregir && (
          <div className="border-t border-line pt-6">
            {!editando ? (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="text-label w-full py-3 rounded-full bg-surface text-ink border border-line hover:bg-line transition-all flex items-center justify-center gap-2"
              >
                <Pencil size={14} /> Corregir tipo, categoría y factura
              </button>
            ) : (
              <div className="space-y-4 animate-premium-fade">
                <div className="space-y-2">
                  <label className="text-label text-ink-2">Tipo de comprobante</label>
                  <SegmentedControl label="Tipo de comprobante" options={TIPO_OPTIONS} value={tipo} onChange={setTipo} fullWidth />
                </div>
                <div className="space-y-2">
                  <label className="text-label text-ink-2">Categoría</label>
                  <BrandSelect value={categoriaId} onChange={setCategoriaId} options={categoriaOptions} placeholder="Elegí una categoría" />
                </div>
                <TextInput
                  label={esF ? 'Proveedor' : 'Proveedor (opcional)'}
                  value={proveedor}
                  onChange={setProveedor}
                  maxLength={80}
                  required={esF}
                />
                {esF && (
                  <div className="grid grid-cols-[1fr_auto] gap-4 items-start animate-premium-fade">
                    <TextInput label="N° de factura (opcional)" value={numeroFactura} onChange={setNumeroFactura} maxLength={40} />
                    <div className="space-y-2 w-28">
                      <label className="text-label text-ink-2">Letra</label>
                      <BrandSelect value={letraFactura} onChange={setLetraFactura} options={LETRA_OPTIONS} placeholder="—" />
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditando(false)} className="text-label flex-1 py-3 rounded-full bg-surface text-ink-2 border border-line">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!puedeGuardarEdicion}
                    onClick={() => setConfirmarEditar(true)}
                    className="text-label flex-1 py-3 rounded-full bg-ink text-on-ink hover:bg-chart-2 disabled:opacity-50"
                  >
                    Guardar corrección
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {gasto.estado === 'vigente' && (
          <div className="border-t border-line pt-6">
            {!anulando ? (
              <button
                type="button"
                onClick={() => setAnulando(true)}
                className="text-label w-full py-3 rounded-inner text-danger border border-danger/30 hover:bg-danger-soft transition-all"
              >
                Anular gasto
              </button>
            ) : (
              <div className="space-y-3">
                <label className="text-label text-danger">Motivo de la anulación (obligatorio)</label>
                <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Se cargó dos veces" className={inputClass} />
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setAnulando(false); setMotivo('') }} className="text-label flex-1 py-3 rounded-full bg-surface text-ink-2 border border-line">
                    Volver
                  </button>
                  <button
                    type="button"
                    disabled={saving || !motivo.trim()}
                    onClick={handleAnular}
                    className="text-label flex-1 py-3 rounded-full bg-danger text-on-ink hover:bg-danger-ink disabled:opacity-50"
                  >
                    Confirmar anulación
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmarSuperadminModal
        isOpen={confirmarEditar}
        onClose={() => setConfirmarEditar(false)}
        onConfirm={handleConfirmEditar}
        titulo="Corregir gasto"
        afectaLinea={`${gasto.descripcion} · ${formatMonto(gasto.monto)} → ${tipo === 'F' ? 'Con factura' : 'Sin factura'}`}
        confirmLabel="Guardar corrección"
      />
    </Modal>
  )
}

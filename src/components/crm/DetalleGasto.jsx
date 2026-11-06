import { useState, useEffect } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { formatMonto, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL } from '../../lib/caja'
import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

const inputClass =
  'w-full bg-surface rounded-inner px-4 py-3 text-ink text-base md:text-body outline-none font-semibold resize-none border border-transparent focus:ring-2 focus:ring-gold'

// Detalle de un gasto ya registrado (Tarea 5) — mismo patrón que DetallePago:
// ver datos y anular con motivo obligatorio (solo si la caja sigue abierta).
export default function DetalleGasto({ isOpen, onClose, gasto }) {
  const { anularGasto } = useData()
  const { alert } = useDialog()
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setAnulando(false)
    setMotivo('')
  }, [isOpen, gasto?.id])

  if (!gasto) return null

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
          <div className="col-span-2">
            <p className="text-label text-ink-2">Concepto</p>
            <p className="text-body font-semibold text-ink mt-1">{gasto.descripcion}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Monto</p>
            <p className={`text-card-title mt-1 ${gasto.estado === 'anulado' ? 'text-ink-2 line-through' : 'text-danger'}`}>
              {formatMonto(gasto.monto)}
            </p>
          </div>
          <div>
            <p className="text-label text-ink-2">Categoría</p>
            <p className="text-body text-ink mt-1">{CATEGORIA_GASTO_LABEL[gasto.categoria] || gasto.categoria}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Medio de pago</p>
            <p className="text-body text-ink mt-1">{MEDIO_PAGO_LABEL[gasto.medio_pago] || gasto.medio_pago}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Fecha</p>
            <p className="text-body text-ink mt-1">{formatFecha(gasto.created_at)}</p>
          </div>
          {gasto.proveedor && (
            <div className="col-span-2">
              <p className="text-label text-ink-2">Proveedor</p>
              <p className="text-body text-ink mt-1">{gasto.proveedor}</p>
            </div>
          )}
        </div>

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
    </Modal>
  )
}

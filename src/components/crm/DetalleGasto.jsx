import { useState, useEffect } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { formatPesos, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL } from '../../lib/caja'
import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

const inputClass =
  'w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-base md:text-sm focus:border-gold/50 outline-none font-bold resize-none'

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
          <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <AlertTriangle className="text-prius-error shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-prius-error uppercase tracking-widest">Gasto anulado</p>
              <p className="text-xs text-prius-slate mt-1">{gasto.anulado_motivo}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Concepto</p>
            <p className="text-sm font-bold text-black mt-1">{gasto.descripcion}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Monto</p>
            <p className={`text-lg font-bold mt-1 ${gasto.estado === 'anulado' ? 'text-prius-muted line-through' : 'text-prius-error'}`}>
              {formatPesos(gasto.monto)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Categoría</p>
            <p className="text-sm text-black mt-1">{CATEGORIA_GASTO_LABEL[gasto.categoria] || gasto.categoria}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Medio de pago</p>
            <p className="text-sm text-black mt-1">{MEDIO_PAGO_LABEL[gasto.medio_pago] || gasto.medio_pago}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fecha</p>
            <p className="text-sm text-black mt-1">{formatFecha(gasto.created_at)}</p>
          </div>
          {gasto.proveedor && (
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Proveedor</p>
              <p className="text-sm text-black mt-1">{gasto.proveedor}</p>
            </div>
          )}
        </div>

        {gasto.estado === 'vigente' && (
          <div className="border-t border-hairline pt-6">
            {!anulando ? (
              <button
                type="button"
                onClick={() => setAnulando(true)}
                className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-prius-error border border-red-500/20 hover:bg-red-500/5 transition-all"
              >
                Anular gasto
              </button>
            ) : (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-prius-error uppercase tracking-widest">Motivo de la anulación (obligatorio)</label>
                <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Se cargó dos veces" className={inputClass} />
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setAnulando(false); setMotivo('') }} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-prius-subtle text-prius-slate border border-hairline">
                    Volver
                  </button>
                  <button
                    type="button"
                    disabled={saving || !motivo.trim()}
                    onClick={handleAnular}
                    className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
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

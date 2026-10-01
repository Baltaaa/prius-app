import { useState, useEffect } from 'react'
import { useData } from '../../context/DataProvider'
import { formatPesos, formatFecha, unidadEmoji } from '../../lib/format'
import {
  formatMedioPago, TIPO_PAGO_LABEL, COMPROBANTE_TIPO_SIGLA, COMPROBANTE_TIPO_LABEL,
  comprobanteEtiqueta,
} from '../../lib/pagos'
import Modal from './Modal'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import { useDialog } from '../../context/DialogProvider'
import { FileText, AlertTriangle } from 'lucide-react'

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold'

const chipClass = (active) =>
  `px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-[#FDE047] text-black border-[#FDE047]' : 'bg-white/5 text-gray-300 border-white/10 hover:text-white'
  }`

// Detalle de un pago ya registrado (Tarea 4): mismo patrón sheet/drawer que
// RegistrarPago. Permite completar/corregir el comprobante y anular con
// motivo. Se abre desde Caja, Clientes o Reservas — un solo componente, no
// se duplica esta lógica en cada pantalla.
export default function DetallePago({ isOpen, onClose, pago, reserva }) {
  const { completarComprobante, anularPago } = useData()
  const { alert } = useDialog()

  const [cargandoComprobante, setCargandoComprobante] = useState(false)
  const [comprobanteTipo, setComprobanteTipo] = useState('factura_b')
  const [puntoVenta, setPuntoVenta] = useState(null)
  const [numero, setNumero] = useState(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setCargandoComprobante(false)
    setAnulando(false)
    setMotivo('')
    setPuntoVenta(null)
    setNumero(null)
    setFecha(new Date().toISOString().split('T')[0])
  }, [isOpen, pago?.id])

  if (!pago) return null

  const unidadLabel = reserva?.unidades ? `${unidadEmoji(reserva.unidades.tipo)} ${reserva.unidades.tipo} #${reserva.unidades.numero}` : ''

  const handleGuardarComprobante = async () => {
    if (!comprobanteTipo || !puntoVenta || !numero) return
    setSaving(true)
    try {
      await completarComprobante(pago.id, { tipo: comprobanteTipo, punto_venta: puntoVenta, numero, fecha })
      setCargandoComprobante(false)
    } catch (err) {
      await alert(err.message || 'No se pudo guardar el comprobante.')
    } finally {
      setSaving(false)
    }
  }

  const handleAnular = async () => {
    if (!motivo.trim()) return
    setSaving(true)
    try {
      await anularPago(pago.id, motivo.trim())
      onClose()
    } catch (err) {
      await alert(err.message || 'No se pudo anular el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Pago N.° ${pago.nro_cuota || ''}`}>
      <div className="space-y-6">
        {reserva && (
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm font-bold text-white uppercase">{unidadLabel}</p>
          </div>
        )}

        {pago.estado === 'anulado' && (
          <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Pago anulado</p>
              <p className="text-xs text-gray-400 mt-1">{pago.anulado_motivo}</p>
              {pago.anulado_at && <p className="text-[10px] text-gray-600 mt-1">{formatFecha(pago.anulado_at)}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto</p>
            <p className={`text-lg font-bold mt-1 ${pago.estado === 'anulado' ? 'text-gray-500 line-through' : 'text-green-400'}`}>
              {formatPesos(pago.monto)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Medio de Pago</p>
            <p className="text-sm font-bold text-white mt-1">{formatMedioPago(pago)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tipo</p>
            <p className="text-sm text-white mt-1">{TIPO_PAGO_LABEL[pago.tipo_pago] || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</p>
            <p className="text-sm text-white mt-1">{formatFecha(pago.fecha_hora || pago.fecha)}</p>
          </div>
          {pago.concepto && (
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Concepto</p>
              <p className="text-sm text-white mt-1">{pago.concepto}</p>
            </div>
          )}
          {pago.referencia && (
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Referencia</p>
              <p className="text-sm text-white mt-1">{pago.referencia}</p>
            </div>
          )}
        </div>

        {/* Comprobante: etiqueta si ya existe, o form para cargarlo/corregirlo */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-white/5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-300">
              <FileText size={14} />
              {pago.comprobante_id ? 'Comprobante' : 'Sin comprobante'}
            </div>
            {!cargandoComprobante && (
              <button
                type="button"
                onClick={() => setCargandoComprobante(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-[#FDE047] hover:text-yellow-300"
              >
                {pago.comprobante_id ? 'Corregir' : 'Cargar'}
              </button>
            )}
          </div>
          {cargandoComprobante && (
            <div className="p-4 space-y-4 bg-black/20">
              <div className="flex flex-wrap gap-2">
                {Object.entries(COMPROBANTE_TIPO_SIGLA).map(([value, sigla]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setComprobanteTipo(value)}
                    title={COMPROBANTE_TIPO_LABEL[value]}
                    className={chipClass(comprobanteTipo === value)}
                  >
                    {sigla}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <IntegerInput value={puntoVenta} onChange={setPuntoVenta} min={1} max={99999} placeholder="Punto de venta" />
                <IntegerInput value={numero} onChange={setNumero} min={1} max={99999999} placeholder="Número" />
              </div>
              <DateInput value={fecha} onChange={setFecha} max={new Date().toISOString().split('T')[0]} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setCargandoComprobante(false)} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-white/5 text-gray-300 border border-white/10">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || !comprobanteTipo || !puntoVenta || !numero}
                  onClick={handleGuardarComprobante}
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#FDE047] text-black disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>

        {pago.estado === 'vigente' && (
          <div className="border-t border-white/5 pt-6">
            {!anulando ? (
              <button
                type="button"
                onClick={() => setAnulando(true)}
                className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-red-400 border border-red-500/20 hover:bg-red-500/5 transition-all"
              >
                Anular pago
              </button>
            ) : (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Motivo de la anulación (obligatorio)</label>
                <textarea
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Se cargó el monto equivocado"
                  className={`${inputClass} resize-none`}
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setAnulando(false); setMotivo('') }} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-white/5 text-gray-300 border border-white/10">
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

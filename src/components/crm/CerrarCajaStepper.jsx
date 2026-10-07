import { useState, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, Check } from 'lucide-react'
import { formatPesos } from '../../lib/format'
import MoneyInput from '../inputs/MoneyInput'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import TextInput from '../inputs/TextInput'
import { useOverlay } from '../../context/OverlayProvider'
import { useDialog } from '../../context/DialogProvider'

const PASOS = ['Arqueo', 'Cierre Z', 'Confirmación']

// Stepper de cierre de caja (Tarea 5), pantalla completa en mobile — 3 pasos:
// 1) arqueo de efectivo (exige observación si hay diferencia), 2) cierre Z
// opcional del controlador fiscal, 3) confirmación. Un solo submit final,
// que llama cerrar_caja (RPC) — nunca escribe nada intermedio.
export default function CerrarCajaStepper({ isOpen, onClose, efectivoEsperado, onConfirm }) {
  const [paso, setPaso] = useState(0)
  const [efectivoContado, setEfectivoContado] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [tieneZ, setTieneZ] = useState(false)
  const [z, setZ] = useState({
    z_numero: null, z_fecha: new Date().toISOString().split('T')[0], z_total: 0,
    z_neto_gravado: 0, z_iva: 0, z_cantidad_comprobantes: null, z_primer_comprobante: '', z_ultimo_comprobante: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPaso(0)
    setEfectivoContado(Number(efectivoEsperado) || 0)
    setObservaciones('')
    setTieneZ(false)
    setSaving(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Overlay central + "¿Descartar cambios?" (Tarea 1, oct 2026) — antes no
  // tenía backdrop-click ni Escape, solo la X. Es un formulario de plata
  // (cierre de caja): cerrarlo por accidente a mitad de un arqueo es
  // justo el caso que la confirmación de la Tarea 1 quiere evitar.
  const overlayId = useId()
  const { confirm } = useDialog()
  const isDirty = () =>
    paso > 0 || Number(efectivoContado) !== Number(efectivoEsperado || 0) || observaciones.trim() !== '' || tieneZ
  const requestClose = async () => {
    if (isDirty()) {
      const ok = await confirm('Tenés cambios sin guardar. ¿Descartarlos?', { title: 'Descartar cambios' })
      if (!ok) return
    }
    onClose()
  }
  const { bind } = useOverlay({ id: `cerrar-caja-${overlayId}`, isOpen, onRequestClose: requestClose })

  if (!isOpen) return null

  const diferencia = Number(efectivoContado) - Number(efectivoEsperado || 0)
  const necesitaObservacion = diferencia !== 0

  const puedeAvanzarPaso1 = !necesitaObservacion || observaciones.trim().length > 0

  const handleConfirmar = async () => {
    setSaving(true)
    try {
      await onConfirm({
        efectivoContado,
        observaciones: observaciones.trim() || null,
        datosZ: tieneZ ? z : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[999] bg-[#0a0d14] sm:bg-black/70 sm:backdrop-blur-md sm:flex sm:items-center sm:justify-center sm:p-4"
      onClick={requestClose}
    >
      <div ref={bind} onClick={(e) => e.stopPropagation()} className="h-full sm:h-auto sm:max-h-[90vh] w-full sm:max-w-lg glass-card sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            {paso > 0 && (
              <button onClick={() => setPaso((p) => p - 1)} className="text-gray-400 hover:text-white">
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-sm uppercase font-bold tracking-[0.2em] text-[#FDE047]">Cerrar Caja</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Paso {paso + 1} de 3 — {PASOS[paso]}</p>
            </div>
          </div>
          <button onClick={requestClose} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {paso === 0 && (
            <>
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Efectivo esperado</span>
                <span className="text-lg font-bold text-white tabular-nums">{formatPesos(efectivoEsperado)}</span>
              </div>
              <MoneyInput label="Efectivo contado" value={efectivoContado} onChange={setEfectivoContado} />
              <div className={`p-4 rounded-xl border text-center ${
                diferencia === 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-[#FDE047]/5 border-[#FDE047]/20'
              }`}>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">Diferencia</p>
                <p className={`text-xl font-bold tabular-nums mt-1 ${diferencia === 0 ? 'text-green-400' : 'text-[#FDE047]'}`}>
                  {formatPesos(diferencia)}
                </p>
              </div>
              {necesitaObservacion && (
                <TextInput
                  as="textarea"
                  rows={3}
                  label="Observaciones (obligatorio)"
                  value={observaciones}
                  onChange={setObservaciones}
                  maxLength={500}
                  placeholder="Ej. Faltó vuelto para un cliente"
                  required
                />
              )}
            </>
          )}

          {paso === 1 && (
            <>
              <button
                type="button"
                onClick={() => setTieneZ((v) => !v)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border text-sm font-bold transition-all ${
                  tieneZ ? 'bg-[#FDE047]/10 border-[#FDE047]/30 text-[#FDE047]' : 'bg-white/5 border-white/10 text-gray-300'
                }`}
              >
                Tengo cierre Z del controlador fiscal
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${tieneZ ? 'bg-[#FDE047] border-[#FDE047]' : 'border-white/30'}`}>
                  {tieneZ && <Check size={12} className="text-black" />}
                </span>
              </button>

              {tieneZ && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <IntegerInput placeholder="N.° de Z" value={z.z_numero} onChange={(v) => setZ({ ...z, z_numero: v })} min={1} />
                    <DateInput value={z.z_fecha} onChange={(v) => setZ({ ...z, z_fecha: v })} max={new Date().toISOString().split('T')[0]} />
                  </div>
                  <MoneyInput label="Total Z" value={z.z_total} onChange={(v) => setZ({ ...z, z_total: v })} />
                  <div className="grid grid-cols-2 gap-4">
                    <MoneyInput label="Neto gravado" value={z.z_neto_gravado} onChange={(v) => setZ({ ...z, z_neto_gravado: v })} />
                    <MoneyInput label="IVA" value={z.z_iva} onChange={(v) => setZ({ ...z, z_iva: v })} />
                  </div>
                  <IntegerInput
                    placeholder="Cantidad de comprobantes"
                    value={z.z_cantidad_comprobantes}
                    onChange={(v) => setZ({ ...z, z_cantidad_comprobantes: v })}
                    min={0}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <TextInput placeholder="Primer comprobante" value={z.z_primer_comprobante} onChange={(v) => setZ({ ...z, z_primer_comprobante: v })} />
                    <TextInput placeholder="Último comprobante" value={z.z_ultimo_comprobante} onChange={(v) => setZ({ ...z, z_ultimo_comprobante: v })} />
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                    La diferencia contra lo registrado en el sistema se muestra en el resumen final.
                  </p>
                </div>
              )}
            </>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Efectivo contado</span>
                  <span className="font-bold text-white tabular-nums">{formatPesos(efectivoContado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Diferencia de arqueo</span>
                  <span className={`font-bold tabular-nums ${diferencia === 0 ? 'text-green-400' : 'text-[#FDE047]'}`}>{formatPesos(diferencia)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cierre Z</span>
                  <span className="font-bold text-white">{tieneZ ? `Cargado (N.° ${z.z_numero || '—'})` : 'No cargado'}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center uppercase tracking-widest">
                Una vez cerrada, no se podrán registrar más movimientos para esta fecha.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 shrink-0">
          {paso < 2 ? (
            <button
              type="button"
              disabled={paso === 0 && !puedeAvanzarPaso1}
              onClick={() => setPaso((p) => p + 1)}
              className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmar}
              className="w-full py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
            >
              {saving ? 'Cerrando...' : 'Cerrar Caja'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

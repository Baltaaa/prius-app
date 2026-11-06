import { useState, useEffect, useId, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, Check } from 'lucide-react'
import { formatMonto } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import MoneyInput from '../inputs/MoneyInput'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import TextInput from '../inputs/TextInput'
import { useOverlay } from '../../context/OverlayProvider'
import { useDialog } from '../../context/DialogProvider'
import LoadingButton from '../ui/LoadingButton'
import ScrollFade from '../ui/ScrollFade'
import { hoyAR } from '../../lib/fechas'

const PASOS = ['Arqueo', 'Cierre Z', 'Confirmación']

// Stepper de cierre de caja (Tarea 5), pantalla completa en mobile — 3 pasos:
// 1) arqueo (exige observación si hay diferencia en CUALQUIER medio, ítem 1
// 25/10/2026: antes solo efectivo), 2) cierre Z opcional del controlador
// fiscal, 3) confirmación. Un solo submit final, que llama cerrar_caja (RPC)
// — nunca escribe nada intermedio.
//
// `porMedio` ({medio, esperado, ...}[]): los medios con movimiento ese día
// (viene de resumen.por_medio, ya precalculado — no se recalcula acá).
// Precarga cada campo con su esperado (el cajero solo lo toca si hay
// diferencia real), excepto efectivo que arranca igual que siempre.
export default function CerrarCajaStepper({ isOpen, onClose, porMedio = [], onConfirm }) {
  const [paso, setPaso] = useState(0)
  const [contadoPorMedio, setContadoPorMedio] = useState({})
  const [observaciones, setObservaciones] = useState('')
  const [tieneZ, setTieneZ] = useState(false)
  const [z, setZ] = useState({
    z_numero: null, z_fecha: hoyAR(), z_total: 0,
    z_neto_gravado: 0, z_iva: 0, z_cantidad_comprobantes: null, z_primer_comprobante: '', z_ultimo_comprobante: '',
  })
  const [saving, setSaving] = useState(false)

  // Efectivo siempre aparece (hay cajón físico para contar incluso en un
  // día sin cobros en efectivo); los demás medios solo si tuvieron
  // movimiento ese día — mismo criterio que ya usaba "Desglose por Medio".
  const medios = useMemo(() => {
    const lista = porMedio.map((m) => ({ ...m, esperado: Number(m.neto ?? m.esperado ?? 0) }))
    if (!lista.some((m) => m.medio === 'efectivo')) {
      lista.unshift({ medio: 'efectivo', esperado: 0, cantidad: 0 })
    }
    return lista
  }, [porMedio])
  const efectivoEsperado = medios.find((m) => m.medio === 'efectivo')?.esperado ?? 0
  const efectivoContado = Number(contadoPorMedio.efectivo ?? 0)

  useEffect(() => {
    if (!isOpen) return
    setPaso(0)
    setContadoPorMedio(Object.fromEntries(medios.map((m) => [m.medio, m.esperado])))
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
    paso > 0 || medios.some((m) => Number(contadoPorMedio[m.medio] ?? 0) !== m.esperado) || observaciones.trim() !== '' || tieneZ
  const requestClose = async () => {
    if (isDirty()) {
      const ok = await confirm('Tenés cambios sin guardar. ¿Descartarlos?', { title: 'Descartar cambios' })
      if (!ok) return
    }
    onClose()
  }
  const { bind } = useOverlay({ id: `cerrar-caja-${overlayId}`, isOpen, onRequestClose: requestClose })

  if (!isOpen) return null

  const diferenciaPorMedio = medios.map((m) => ({ ...m, contado: Number(contadoPorMedio[m.medio] ?? 0), diferencia: Number(contadoPorMedio[m.medio] ?? 0) - m.esperado }))
  const diferencia = diferenciaPorMedio.reduce((acc, m) => acc + m.diferencia, 0)
  const necesitaObservacion = diferencia !== 0

  const puedeAvanzarPaso1 = !necesitaObservacion || observaciones.trim().length > 0

  const handleConfirmar = async () => {
    setSaving(true)
    try {
      await onConfirm({
        efectivoContado,
        contadoPorMedio,
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
      className="fixed inset-0 z-[999] bg-card sm:bg-overlay sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4"
      onClick={requestClose}
    >
      <div ref={bind} onClick={(e) => e.stopPropagation()} className="card-surface h-full sm:h-auto sm:max-h-[90dvh] w-full sm:max-w-lg sm:rounded-card flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-line bg-surface shrink-0">
          <div className="flex items-center gap-3">
            {paso > 0 && (
              <button onClick={() => setPaso((p) => p - 1)} className="text-ink-2 hover:text-ink">
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-label text-ink">Cerrar Caja</h2>
              <p className="text-label text-ink-2 mt-1">Paso {paso + 1} de 3 — {PASOS[paso]}</p>
            </div>
          </div>
          <button onClick={requestClose} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-surface rounded-full text-ink-2 hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <ScrollFade wrapperClassName="flex-1" className="overflow-y-auto p-6 sm:p-8 space-y-6">
          {paso === 0 && (
            <>
              {/* Ítem 1 (25/10/2026): un bloque por medio con movimiento ese
                  día (siempre incluye efectivo) — Esperado de solo lectura,
                  Contado editable y precargado con el esperado (el cajero
                  solo lo toca si hay diferencia real), Diferencia en vivo. */}
              <div className="space-y-4">
                {diferenciaPorMedio.map((m) => (
                  <div key={m.medio} className="space-y-2 pb-4 border-b border-line last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-label text-ink">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                      <span className="text-label text-ink-2">Esperado <strong className="text-ink tabular-nums">{formatMonto(m.esperado)}</strong></span>
                    </div>
                    <MoneyInput
                      label={`${MEDIO_PAGO_LABEL[m.medio] || m.medio} contado/verificado`}
                      value={contadoPorMedio[m.medio] ?? 0}
                      onChange={(v) => setContadoPorMedio((prev) => ({ ...prev, [m.medio]: v }))}
                    />
                    {m.diferencia !== 0 && (
                      <p className={`text-label font-semibold tabular-nums ${m.diferencia > 0 ? 'text-success-ink' : 'text-danger'}`}>
                        Diferencia: {formatMonto(m.diferencia)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className={`p-4 rounded-inner border text-center ${
                diferencia === 0 ? 'bg-success-soft border-success/30' : 'bg-gold-100 border-gold-300'
              }`}>
                <p className="text-label text-ink-2">Diferencia total</p>
                <p className={`text-card-title tabular-nums mt-1 ${diferencia === 0 ? 'text-success-ink' : 'text-ink'}`}>
                  {formatMonto(diferencia)}
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
                className={`w-full flex items-center justify-between px-4 py-4 rounded-inner border text-body font-semibold transition-all ${
                  tieneZ ? 'bg-gold-100 border-gold-300 text-ink' : 'bg-surface border-line text-ink-2'
                }`}
              >
                Tengo cierre Z del controlador fiscal
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${tieneZ ? 'bg-gold border-gold' : 'border-line'}`}>
                  {tieneZ && <Check size={12} className="text-ink" />}
                </span>
              </button>

              {tieneZ && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <IntegerInput placeholder="N.° de Z" value={z.z_numero} onChange={(v) => setZ({ ...z, z_numero: v })} min={1} />
                    <DateInput value={z.z_fecha} onChange={(v) => setZ({ ...z, z_fecha: v })} max={hoyAR()} />
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
                  <p className="text-label text-ink-2">
                    La diferencia contra lo registrado en el sistema se muestra en el resumen final.
                  </p>
                </div>
              )}
            </>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <div className="p-5 bg-surface border border-line rounded-inner space-y-3">
                {diferenciaPorMedio.map((m) => (
                  <div key={m.medio} className="flex justify-between text-body">
                    <span className="text-ink-2">{MEDIO_PAGO_LABEL[m.medio] || m.medio} contado</span>
                    <span className="font-semibold text-ink tabular-nums">{formatMonto(m.contado)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-body pt-2 border-t border-line">
                  <span className="text-ink-2">Diferencia total de arqueo</span>
                  <span className={`font-semibold tabular-nums ${diferencia === 0 ? 'text-success-ink' : 'text-ink'}`}>{formatMonto(diferencia)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-ink-2">Cierre Z</span>
                  <span className="font-semibold text-ink">{tieneZ ? `Cargado (N.° ${z.z_numero || '—'})` : 'No cargado'}</span>
                </div>
              </div>
              <p className="text-label text-ink-2 text-center">
                Una vez cerrada, no se podrán registrar más movimientos para esta fecha.
              </p>
            </div>
          )}
        </ScrollFade>

        <div className="p-6 border-t border-line shrink-0">
          {paso < 2 ? (
            <button
              type="button"
              disabled={paso === 0 && !puedeAvanzarPaso1}
              onClick={() => setPaso((p) => p + 1)}
              className="text-label w-full py-4 bg-ink hover:bg-chart-2 disabled:opacity-50 rounded-full transition-all text-on-ink"
            >
              Continuar
            </button>
          ) : (
            <LoadingButton
              loading={saving}
              loadingText="Cerrando..."
              onClick={handleConfirmar}
              className="text-label w-full py-4 bg-danger hover:bg-danger-ink text-on-ink rounded-inner"
            >
              Cerrar Caja
            </LoadingButton>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

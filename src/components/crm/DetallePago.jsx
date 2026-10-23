import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../context/DataProvider'
import { linkToCliente } from '../../lib/deepLinks'
import { formatPesos, formatFecha, formatFechaHora, unidadEmoji, formatComprobante } from '../../lib/format'
import {
  formatMedioPago, TIPO_PAGO_LABEL, COMPROBANTE_TIPO_SIGLA, COMPROBANTE_TIPO_LABEL,
} from '../../lib/pagos'
import { pagoSinVerificar } from '../../lib/reservas'
import Modal from './Modal'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import MoneyInput from '../inputs/MoneyInput'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { FileText, AlertTriangle, Pencil } from 'lucide-react'

const inputClass =
  'w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-base md:text-sm focus:border-gold/50 outline-none font-bold'

const chipClass = (active) =>
  `px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-gold text-black border-gold' : 'bg-prius-subtle text-prius-slate border-hairline hover:text-black'
  }`

// Detalle de un pago ya registrado (Tarea 4): mismo patrón sheet/drawer que
// RegistrarPago. Permite completar/corregir el comprobante y anular con
// motivo. Se abre desde Caja, Clientes o Reservas — un solo componente, no
// se duplica esta lógica en cada pantalla.
export default function DetallePago({ isOpen, onClose, pago, reserva, autoAbrirMonto = false, onEditarMonto }) {
  const navigate = useNavigate()
  const { completarComprobante, anularPago, editarComprobante, editarMontoPagoVigente } = useData()
  const { alert } = useDialog()
  const puedeEditarComprobante = usePermiso('editar_comprobante')
  const puedeEditarMontoPago = usePermiso('editar_monto_pago')
  // Items 9/10 (testing oct 2026): anular y editar el monto de un pago ya
  // verificado quedan detrás de superadmin — espeja el guard real de los
  // RPC (anular_pago / fn_editar_monto_pago_vigente), acá es solo para
  // ocultar los botones a quien no tiene permiso.
  const puedeAnularPago = usePermiso('anular_pago')
  const puedeEditarMontoVigente = usePermiso('editar_monto_pago_vigente')

  const [cargandoComprobante, setCargandoComprobante] = useState(false)
  const [comprobanteTipo, setComprobanteTipo] = useState('factura_b')
  const [puntoVenta, setPuntoVenta] = useState(null)
  const [numero, setNumero] = useState(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const [editandoId, setEditandoId] = useState(null)
  const [editMonto, setEditMonto] = useState(null)
  const [editFecha, setEditFecha] = useState('')
  const [editTipo, setEditTipo] = useState(null)

  // Item 9 (testing oct 2026): editar el monto de un pago ya verificado —
  // distinto del flujo "Cargar monto" (onEditarMonto) de un recibo migrado
  // todavía sin monto.
  const [editandoMontoPago, setEditandoMontoPago] = useState(false)
  const [editMontoPago, setEditMontoPago] = useState(null)

  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')

  // Oct 2026 (pendiente pago_sin_monto, "Cargar monto con datos completos"):
  // ya no hay un mini-form propio acá — "Cargar monto" delega en el padre
  // (`onEditarMonto`), que abre RegistrarPago en modo edición (mismo form
  // completo de monto/medio/tipo/fecha/comprobante, UPDATE sobre este pago).
  // `autoAbrirMonto` (desde la notificación, accion=cargar_monto/
  // cargar_recibos) dispara ese mismo callback apenas se monta, sin
  // esperar un segundo click.
  useEffect(() => {
    if (!isOpen) return
    setCargandoComprobante(false)
    setAnulando(false)
    setMotivo('')
    setPuntoVenta(null)
    setNumero(null)
    setFecha(new Date().toISOString().split('T')[0])
    setEditandoId(null)
    setEditandoMontoPago(false)
    setEditMontoPago(null)
    if (autoAbrirMonto && pagoSinVerificar(pago) && pago?.estado !== 'anulado' && puedeEditarMontoPago) {
      onEditarMonto?.(pago)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const abrirEdicion = (comprobante) => {
    setEditandoId(comprobante.id)
    setEditMonto(comprobante.monto_total ?? null)
    setEditFecha(comprobante.fecha || new Date().toISOString().split('T')[0])
    setEditTipo(comprobante.tipo || null)
  }

  const handleGuardarEdicion = async () => {
    setSaving(true)
    try {
      await editarComprobante(editandoId, editMonto, editFecha, editTipo)
      setEditandoId(null)
    } catch (err) {
      await alert(err.message || 'No se pudo editar el comprobante.')
    } finally {
      setSaving(false)
    }
  }

  // Item 9 (testing oct 2026): corrige el monto de ESTE pago (no de su
  // comprobante) — ej. error de tipeo del administrador al cargarlo.
  const handleGuardarMontoPago = async () => {
    if (!editMontoPago || Number(editMontoPago) <= 0) return
    setSaving(true)
    try {
      await editarMontoPagoVigente(pago.id, editMontoPago)
      setEditandoMontoPago(false)
    } catch (err) {
      await alert(err.message || 'No se pudo editar el monto del pago.')
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

  // Ítem 4 (oct 2026): la suma de los comprobantes de este pago puede no
  // coincidir con el monto del pago — se avisa, pero nunca bloquea guardar
  // (ver migración 20261005140200_editar_comprobante_rpc).
  const comprobantes = pago.comprobantes || []
  const sumaComprobantes = comprobantes.reduce((acc, c) => acc + Number(c.monto_total || 0), 0)
  const comprobantesPendientes = comprobantes.filter((c) => c.monto_total == null).length
  const sumaNoCoincide = comprobantes.length > 0 && sumaComprobantes !== Number(pago.monto || 0)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Pago N.° ${pago.nro_cuota || ''}`}>
      <div className="space-y-6">
        {reserva && (
          <div className="p-4 bg-prius-subtle border border-hairline rounded-xl">
            <p className="text-sm font-bold text-black uppercase">{unidadLabel}</p>
          </div>
        )}

        {/* Abierto desde Caja (Tarea 9, oct 2026): la fila de movimiento no
            tenía ningún link al cliente, solo texto plano — acá sí hay
            cliente_id en el pago sin importar desde dónde se abrió. */}
        {pago.cliente_id && (
          <button
            type="button"
            onClick={() => { onClose?.(); navigate(linkToCliente(pago.cliente_id, { pagoId: pago.id })) }}
            className="text-[10px] font-bold uppercase tracking-widest text-gold hover:underline"
          >
            Ver cliente →
          </button>
        )}

        {pago.estado === 'anulado' && (
          <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <AlertTriangle className="text-prius-error shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-prius-error uppercase tracking-widest">Pago anulado</p>
              <p className="text-xs text-prius-slate mt-1">{pago.anulado_motivo}</p>
              {pago.anulado_at && <p className="text-[10px] text-prius-muted mt-1">{formatFecha(pago.anulado_at)}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Monto</p>
            <div className="flex items-center gap-3 mt-1">
              <p className={`text-lg font-bold ${pago.estado === 'anulado' ? 'text-prius-muted line-through' : pagoSinVerificar(pago) ? 'text-prius-error' : 'text-prius-success'}`}>
                {pagoSinVerificar(pago) ? 'Monto nulo' : formatPesos(pago.monto)}
              </p>
              {pagoSinVerificar(pago) && pago.estado !== 'anulado' && puedeEditarMontoPago && (
                <button
                  type="button"
                  onClick={() => onEditarMonto?.(pago)}
                  className="text-[10px] font-bold uppercase tracking-widest text-gold hover:text-black"
                >
                  Cargar monto
                </button>
              )}
              {/* Item 9 (testing oct 2026): corregir el monto de un pago YA
                  verificado — solo superadmin, distinto de "Cargar monto"
                  (que es para un recibo migrado sin verificar). */}
              {!pagoSinVerificar(pago) && pago.estado !== 'anulado' && puedeEditarMontoVigente && !editandoMontoPago && (
                <button
                  type="button"
                  onClick={() => { setEditandoMontoPago(true); setEditMontoPago(pago.monto) }}
                  className="text-prius-muted hover:text-gold transition-all p-1 -m-1"
                  title="Editar monto"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            {editandoMontoPago && (
              <div className="mt-3 space-y-2 p-3 bg-prius-subtle border border-hairline rounded-xl">
                <MoneyInput label="Nuevo monto" value={editMontoPago} onChange={setEditMontoPago} max={100_000_000} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditandoMontoPago(false)} className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white text-prius-slate border border-hairline">
                    Cancelar
                  </button>
                  <button type="button" disabled={saving} onClick={handleGuardarMontoPago} className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-gold text-black disabled:opacity-50">
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Medio de Pago</p>
            <p className="text-sm font-bold text-black mt-1">{formatMedioPago(pago)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Tipo</p>
            <p className="text-sm text-black mt-1">{TIPO_PAGO_LABEL[pago.tipo_pago] || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fecha</p>
            {/* pago.fecha es la fecha real del pago (editable, la del
                comprobante si vino con uno) — nunca fecha_hora, que es solo
                el timestamp de carga en el sistema (auditoría). */}
            <p className="text-sm text-black mt-1">{formatFecha(pago.fecha)}</p>
            {pago.fecha_hora && (
              <p className="text-[10px] text-prius-muted mt-0.5">Cargado el {formatFechaHora(pago.fecha_hora)}</p>
            )}
          </div>
          {pago.concepto && (
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Concepto</p>
              <p className="text-sm text-black mt-1">{pago.concepto}</p>
            </div>
          )}
          {pago.referencia && (
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Referencia</p>
              <p className="text-sm text-black mt-1">{pago.referencia}</p>
            </div>
          )}
        </div>

        {/* Comprobante: etiqueta si ya existe, o form para cargarlo/corregirlo */}
        <div className="border border-hairline rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-prius-subtle">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-prius-slate">
              <FileText size={14} />
              {comprobantes.length === 0 && 'Sin comprobante'}
            </div>
            {!cargandoComprobante && (
              <button
                type="button"
                onClick={() => setCargandoComprobante(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-gold hover:text-black"
              >
                {comprobantes.length > 0 ? 'Agregar otro' : 'Cargar'}
              </button>
            )}
          </div>

          {comprobantes.length > 0 && (
            <div className="divide-y divide-hairline">
              {comprobantes.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  {editandoId === c.id ? (
                    <div className="flex-1 space-y-3">
                      {/* Tipo de comprobante (item 9, testing oct 2026):
                          antes esta edición solo tocaba monto/fecha. */}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(COMPROBANTE_TIPO_SIGLA).map(([value, sigla]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setEditTipo(value)}
                            title={COMPROBANTE_TIPO_LABEL[value]}
                            className={chipClass(editTipo === value)}
                          >
                            {sigla}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <MoneyInput label="Monto" value={editMonto} onChange={setEditMonto} max={100_000_000} />
                        <DateInput label="Fecha" value={editFecha} onChange={setEditFecha} max={new Date().toISOString().split('T')[0]} calendarOnly />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditandoId(null)} className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-prius-subtle text-prius-slate border border-hairline">
                          Cancelar
                        </button>
                        <button type="button" disabled={saving} onClick={handleGuardarEdicion} className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-gold text-black disabled:opacity-50">
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs">
                        <span className="font-bold text-black uppercase tracking-widest">{formatComprobante(c.tipo, c.numero)}</span>
                        {c.fecha && <span className="text-prius-muted"> · {formatFecha(c.fecha)}</span>}
                        <span className={`ml-2 font-bold ${c.monto_total == null ? 'text-prius-error' : 'text-prius-success'}`}>
                          {c.monto_total == null ? 'Sin monto' : formatPesos(c.monto_total)}
                        </span>
                      </div>
                      {puedeEditarComprobante && (
                        <button
                          type="button"
                          onClick={() => abrirEdicion(c)}
                          className="shrink-0 text-prius-muted hover:text-gold transition-all p-2 -m-2"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              {sumaNoCoincide && (
                <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/5">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={14} />
                  <p className="text-[11px] text-amber-400">
                    La suma de comprobantes ({formatPesos(sumaComprobantes)}) no coincide con el monto del pago ({formatPesos(pago.monto)}).
                  </p>
                </div>
              )}
              {comprobantesPendientes > 0 && (
                <p className="px-4 py-2 text-[10px] text-prius-muted uppercase tracking-widest">
                  {comprobantesPendientes} comprobante{comprobantesPendientes > 1 ? 's' : ''} sin monto cargado
                </p>
              )}
            </div>
          )}
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
                <button type="button" onClick={() => setCargandoComprobante(false)} className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-prius-subtle text-prius-slate border border-hairline">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || !comprobanteTipo || !puntoVenta || !numero}
                  onClick={handleGuardarComprobante}
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-gold text-black disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Item 10 (testing oct 2026): anular un pago requiere superadmin —
            antes el botón se mostraba a cualquier usuario autenticado. */}
        {pago.estado === 'vigente' && puedeAnularPago && (
          <div className="border-t border-hairline pt-6">
            {!anulando ? (
              <button
                type="button"
                onClick={() => setAnulando(true)}
                className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-prius-error border border-red-500/20 hover:bg-red-500/5 transition-all"
              >
                Anular pago
              </button>
            ) : (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-prius-error uppercase tracking-widest">Motivo de la anulación (obligatorio)</label>
                <textarea
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Se cargó el monto equivocado"
                  className={`${inputClass} resize-none`}
                />
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

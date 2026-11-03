import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../context/DataProvider'
import { linkToCliente } from '../../lib/deepLinks'
import { formatPesos, formatFecha, formatFechaHora, unidadEmoji, formatComprobante, formatUnidad} from '../../lib/format'
import {
  formatMedioPago, TIPO_PAGO_LABEL, COMPROBANTE_TIPO_SIGLA, COMPROBANTE_TIPO_LABEL,
} from '../../lib/pagos'
import { pagoSinVerificar } from '../../lib/reservas'
import Modal from './Modal'
import ConfirmarSuperadminModal from './ConfirmarSuperadminModal'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import MoneyInput from '../inputs/MoneyInput'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { FileText, AlertTriangle, Pencil } from 'lucide-react'

const inputClass =
  'w-full bg-surface rounded-inner px-4 py-3 text-ink text-base md:text-body outline-none font-semibold border border-transparent focus:ring-2 focus:ring-gold'

const chipClass = (active) =>
  `px-3 py-3 rounded-full text-label border transition-all min-h-[44px] ${
    active ? 'bg-ink text-on-ink border-ink' : 'bg-surface text-ink-2 border-line hover:text-ink'
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

  // Mini-prompt 26/10/2026: las tres acciones de superadmin de este modal
  // (anular pago, editar comprobante, editar monto vigente) pasan a pedir
  // contraseña — cada botón de "Guardar/Confirmar" de más abajo deja de
  // llamar la acción directo y en cambio abre ConfirmarSuperadminModal; el
  // motivo/monto/tipo ya cargados en el form quedan en estado hasta que la
  // contraseña se verifica.
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [confirmarEditarComprobante, setConfirmarEditarComprobante] = useState(false)
  const [confirmarEditarMonto, setConfirmarEditarMonto] = useState(false)

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

  const unidadLabel = reserva?.unidades ? `${unidadEmoji(reserva.unidades.tipo)} ${formatUnidad(reserva.unidades.tipo, reserva.unidades.numero)}` : ''

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

  const handleGuardarEdicion = () => setConfirmarEditarComprobante(true)

  const handleConfirmEditarComprobante = async (password) => {
    await editarComprobante(editandoId, editMonto, editFecha, editTipo, password)
    setEditandoId(null)
    setConfirmarEditarComprobante(false)
  }

  // Item 9 (testing oct 2026): corrige el monto de ESTE pago (no de su
  // comprobante) — ej. error de tipeo del administrador al cargarlo.
  const handleGuardarMontoPago = () => {
    if (!editMontoPago || Number(editMontoPago) <= 0) return
    setConfirmarEditarMonto(true)
  }

  const handleConfirmEditarMonto = async (password) => {
    await editarMontoPagoVigente(pago.id, editMontoPago, password)
    setEditandoMontoPago(false)
    setConfirmarEditarMonto(false)
  }

  const handleAnular = () => {
    if (!motivo.trim()) return
    setConfirmarAnular(true)
  }

  const handleConfirmAnular = async (password) => {
    await anularPago(pago.id, motivo.trim(), password)
    setConfirmarAnular(false)
    onClose()
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
          <div className="p-4 bg-surface border border-line rounded-inner">
            <p className="text-label text-ink">{unidadLabel}</p>
          </div>
        )}

        {/* Abierto desde Caja (Tarea 9, oct 2026): la fila de movimiento no
            tenía ningún link al cliente, solo texto plano — acá sí hay
            cliente_id en el pago sin importar desde dónde se abrió. */}
        {pago.cliente_id && (
          <button
            type="button"
            onClick={() => { onClose?.(); navigate(linkToCliente(pago.cliente_id, { pagoId: pago.id })) }}
            className="text-label text-ink hover:underline"
          >
            Ver cliente →
          </button>
        )}

        {pago.estado === 'anulado' && (
          <div className="flex items-start gap-3 p-4 bg-danger-soft border border-danger/30 rounded-inner">
            <AlertTriangle className="text-danger shrink-0 mt-1" size={18} />
            <div>
              <p className="text-label text-danger">Pago anulado</p>
              <p className="text-label text-ink-2 mt-1">{pago.anulado_motivo}</p>
              {pago.anulado_at && <p className="text-label text-ink-2 mt-1">{formatFecha(pago.anulado_at)}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <p className="text-label text-ink-2">Monto</p>
            <div className="flex items-center gap-3 mt-1">
              <p className={`text-card-title ${pago.estado === 'anulado' ? 'text-ink-2 line-through' : pagoSinVerificar(pago) ? 'text-danger' : 'text-success-ink'}`}>
                {pagoSinVerificar(pago) ? 'Monto nulo' : formatPesos(pago.monto)}
              </p>
              {pagoSinVerificar(pago) && pago.estado !== 'anulado' && puedeEditarMontoPago && (
                <button
                  type="button"
                  onClick={() => onEditarMonto?.(pago)}
                  className="text-label text-ink hover:text-ink"
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
                  className="text-ink-2 hover:text-ink transition-all p-1 -m-1"
                  title="Editar monto"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            {editandoMontoPago && (
              <div className="mt-3 space-y-2 p-3 bg-surface border border-line rounded-inner">
                <MoneyInput label="Nuevo monto" value={editMontoPago} onChange={setEditMontoPago} max={100_000_000} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditandoMontoPago(false)} className="text-label flex-1 py-2 rounded-full bg-card text-ink-2 border border-line">
                    Cancelar
                  </button>
                  <button type="button" disabled={saving} onClick={handleGuardarMontoPago} className="text-label flex-1 py-2 rounded-full bg-gold text-ink disabled:opacity-50">
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="text-label text-ink-2">Medio de Pago</p>
            <p className="text-body font-semibold text-ink mt-1">{formatMedioPago(pago)}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Tipo</p>
            <p className="text-body text-ink mt-1">{TIPO_PAGO_LABEL[pago.tipo_pago] || '—'}</p>
          </div>
          <div>
            <p className="text-label text-ink-2">Fecha</p>
            {/* pago.fecha es la fecha real del pago (editable, la del
                comprobante si vino con uno) — nunca fecha_hora, que es solo
                el timestamp de carga en el sistema (auditoría). */}
            <p className="text-body text-ink mt-1">{formatFecha(pago.fecha)}</p>
            {pago.fecha_hora && (
              <p className="text-label text-ink-2 mt-1">Cargado el {formatFechaHora(pago.fecha_hora)}</p>
            )}
          </div>
          {pago.concepto && (
            <div className="col-span-2">
              <p className="text-label text-ink-2">Concepto</p>
              <p className="text-body text-ink mt-1">{pago.concepto}</p>
            </div>
          )}
          {pago.referencia && (
            <div className="col-span-2">
              <p className="text-label text-ink-2">Referencia</p>
              <p className="text-body text-ink mt-1">{pago.referencia}</p>
            </div>
          )}
        </div>

        {/* Comprobante: etiqueta si ya existe, o form para cargarlo/corregirlo */}
        <div className="border border-line rounded-inner overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface">
            <div className="text-label flex items-center gap-2 text-ink-2">
              <FileText size={14} />
              {comprobantes.length === 0 && 'Sin comprobante'}
            </div>
            {!cargandoComprobante && (
              <button
                type="button"
                onClick={() => setCargandoComprobante(true)}
                className="text-label text-ink hover:text-ink"
              >
                {comprobantes.length > 0 ? 'Agregar otro' : 'Cargar'}
              </button>
            )}
          </div>

          {comprobantes.length > 0 && (
            <div className="divide-y divide-divider">
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
                        <button type="button" onClick={() => setEditandoId(null)} className="text-label flex-1 py-2 rounded-full bg-surface text-ink-2 border border-line">
                          Cancelar
                        </button>
                        <button type="button" disabled={saving} onClick={handleGuardarEdicion} className="text-label flex-1 py-2 rounded-full bg-gold text-ink disabled:opacity-50">
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-label">
                        <span className="text-label text-ink">{formatComprobante(c.tipo, c.numero)}</span>
                        {c.fecha && <span className="text-ink-2"> · {formatFecha(c.fecha)}</span>}
                        <span className={`ml-2 font-semibold ${c.monto_total == null ? 'text-danger' : 'text-success-ink'}`}>
                          {c.monto_total == null ? 'Sin monto' : formatPesos(c.monto_total)}
                        </span>
                      </div>
                      {puedeEditarComprobante && (
                        <button
                          type="button"
                          onClick={() => abrirEdicion(c)}
                          className="shrink-0 text-ink-2 hover:text-ink transition-all p-2 -m-2"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              {sumaNoCoincide && (
                <div className="flex items-start gap-2 px-4 py-3 bg-gold-100">
                  <AlertTriangle className="text-ink shrink-0 mt-1" size={14} />
                  <p className="text-label text-ink">
                    La suma de comprobantes ({formatPesos(sumaComprobantes)}) no coincide con el monto del pago ({formatPesos(pago.monto)}).
                  </p>
                </div>
              )}
              {comprobantesPendientes > 0 && (
                <p className="text-label px-4 py-2 text-ink-2">
                  {comprobantesPendientes} comprobante{comprobantesPendientes > 1 ? 's' : ''} sin monto cargado
                </p>
              )}
            </div>
          )}
          {cargandoComprobante && (
            <div className="p-4 space-y-4 bg-surface">
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
                <button type="button" onClick={() => setCargandoComprobante(false)} className="text-label flex-1 py-3 rounded-full bg-surface text-ink-2 border border-line">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || !comprobanteTipo || !puntoVenta || !numero}
                  onClick={handleGuardarComprobante}
                  className="text-label flex-1 py-3 rounded-full bg-gold text-ink disabled:opacity-50"
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
          <div className="border-t border-line pt-6">
            {!anulando ? (
              <button
                type="button"
                onClick={() => setAnulando(true)}
                className="text-label w-full py-3 rounded-inner text-danger border border-danger/30 hover:bg-danger-soft transition-all"
              >
                Anular pago
              </button>
            ) : (
              <div className="space-y-3">
                <label className="text-label text-danger">Motivo de la anulación (obligatorio)</label>
                <textarea
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Se cargó el monto equivocado"
                  className={`${inputClass} resize-none`}
                />
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
        isOpen={confirmarAnular}
        onClose={() => setConfirmarAnular(false)}
        onConfirm={handleConfirmAnular}
        titulo="Anular pago"
        afectaLinea={`${formatPesos(pago.monto)} · ${motivo.trim()}`}
        confirmLabel="Anular"
      />
      <ConfirmarSuperadminModal
        isOpen={confirmarEditarComprobante}
        onClose={() => setConfirmarEditarComprobante(false)}
        onConfirm={handleConfirmEditarComprobante}
        titulo="Editar comprobante"
        afectaLinea="Cambia el monto, la fecha o el tipo de este comprobante."
        confirmLabel="Guardar"
      />
      <ConfirmarSuperadminModal
        isOpen={confirmarEditarMonto}
        onClose={() => setConfirmarEditarMonto(false)}
        onConfirm={handleConfirmEditarMonto}
        titulo="Editar monto del pago"
        afectaLinea={`Nuevo monto: ${formatPesos(editMontoPago)}`}
        confirmLabel="Guardar"
      />
    </Modal>
  )
}

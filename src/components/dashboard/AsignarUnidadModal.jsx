import { useState } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { usePagoComprobanteForm } from '../../hooks/usePagoComprobanteForm'
import { useRevealOnCheck } from '../../hooks/useRevealOnCheck'
import Modal from '../crm/Modal'
import ClienteSelector from '../crm/ClienteSelector'
import PagoComprobanteCampos from '../crm/PagoComprobanteCampos'
import MoneyInput from '../inputs/MoneyInput'
import LoadingButton from '../ui/LoadingButton'
import { unidadEmoji } from '../../lib/format'

// Asignar una unidad libre a un cliente de temporada, SIN salir del Plano —
// mismo ClienteSelector (existente o nuevo) que usa Reservas.jsx (ítem 5,
// oct 2026). Antes esto navegaba a Clientes.jsx, que solo permitía crear un
// cliente nuevo, nunca elegir uno ya existente.
//
// Item 3 (oct 2026): el primer pago con su comprobante se carga sí o sí acá
// mismo, en una sola transacción con la reserva (fn_crear_reserva_con_pago)
// — ya no hay "cargar un pago ahora" que encadene un RegistrarPago aparte.
// Única excepción: "Cargar más tarde". Las unidades bonificadas no piden
// pago. Mismo bloque de campos (PagoComprobanteCampos) que usa Reservas.jsx.
export default function AsignarUnidadModal({ isOpen, onClose, unit, temporadaActiva }) {
  const { crearReservaConPago, clientes } = useData()
  const { alert } = useDialog()
  const [clienteId, setClienteId] = useState('')
  const [valorTotal, setValorTotal] = useState(0)
  const [bonificada, setBonificada] = useState(false)
  const [cargarMasTarde, setCargarMasTarde] = useState(false)
  const [notas] = useState('')
  const [saving, setSaving] = useState(false)

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null
  const pagoForm = usePagoComprobanteForm({
    resetKey: isOpen ? 'asignar-abierto' : 'cerrado',
    cliente: clienteSeleccionado,
    reservaInfo: {
      total: bonificada ? 0 : Number(valorTotal || 0),
      saldo: bonificada ? 0 : Number(valorTotal || 0),
      saldoDesconocido: false,
      pagado: 0,
      unidadLabel: `${unidadEmoji(unit?.type)} ${unit?.type === 'sombrilla' ? 'Sombrilla' : 'Carpa'} #${unit?.number}`,
      temporadaOTipo: temporadaActiva?.nombre,
      sinReserva: false,
    },
  })

  const requierePago = !bonificada && !cargarMasTarde
  const revealRef = useRevealOnCheck(!cargarMasTarde)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId || !unit?.dbId) return

    if (requierePago) {
      if (Number(pagoForm.monto) <= 0) {
        await alert('Cargá el monto del primer pago, o tildá "Cargar más tarde".')
        return
      }
      if (pagoForm.excedeSaldo) {
        await alert(`El monto supera el total de la reserva.`)
        return
      }
      if (pagoForm.comprobanteIncompleto) {
        await alert('El comprobante del primer pago es obligatorio: completá tipo, número y fecha.')
        return
      }
      if (pagoForm.duplicado) {
        await alert('Ese número de comprobante ya está cargado en otro pago.')
        return
      }
    }

    setSaving(true)
    try {
      const pagoPayload = requierePago ? {
        cliente_id: clienteId,
        monto: pagoForm.monto,
        medio: pagoForm.medio,
        tipo_pago: pagoForm.tipoPago || 'parcial',
        concepto: pagoForm.concepto,
        referencia: pagoForm.referencia,
        comprobante: pagoForm.construirComprobantePayload(),
        fecha: pagoForm.fechaComprobante,
      } : null
      await crearReservaConPago({
        reserva: {
          cliente_id: clienteId,
          unidad_id: unit.dbId,
          tipo_alquiler: 'temporada',
          estado: 'activa',
          origen: 'manual',
          valor_total: bonificada ? 0 : Number(valorTotal || 0),
          bonificada,
          notas,
        },
        pago: pagoPayload,
      })
      onClose()
      setBonificada(false)
      setCargarMasTarde(false)
      setValorTotal(0)
      setClienteId('')
    } catch (err) {
      await alert(err.message || 'No se pudo asignar la unidad.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Asignar ${unidadEmoji(unit?.type)} ${unit?.type === 'sombrilla' ? 'Sombrilla' : 'Carpa'} #${unit?.number}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Cliente</label>
          <ClienteSelector value={clienteId} onChange={(id) => setClienteId(id)} autoFocus />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Temporada</label>
          <p className="text-sm text-black">{temporadaActiva?.nombre || '—'}</p>
        </div>
        <MoneyInput
          label="Monto Total"
          value={bonificada ? 0 : valorTotal}
          onChange={setValorTotal}
          disabled={bonificada}
          max={100_000_000}
          hint={bonificada ? 'Carpa bonificada: sin cargo, no registra pagos.' : undefined}
        />
        <label className="flex items-center gap-2 text-xs text-prius-slate cursor-pointer">
          <input type="checkbox" checked={bonificada} onChange={(e) => setBonificada(e.target.checked)} className="accent-cyan-400 w-4 h-4" />
          Unidad bonificada
        </label>

        {/* Item 3 (oct 2026): primer pago inline y obligatorio, salvo
            bonificada o "Cargar más tarde" — mismo bloque que Reservas.jsx. */}
        {!bonificada && (
          <div className="space-y-4">
            {!cargarMasTarde && (
              <div ref={revealRef} className="animate-premium-fade">
                <PagoComprobanteCampos form={pagoForm} />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cargarMasTarde}
                onChange={(e) => setCargarMasTarde(e.target.checked)}
                className="accent-gold w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-black uppercase tracking-widest">Cargar más tarde</span>
            </label>
          </div>
        )}

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Asignando..."
          disabled={
            !clienteId || (requierePago && (Number(pagoForm.monto) <= 0 || pagoForm.excedeSaldo || pagoForm.comprobanteIncompleto || !!pagoForm.duplicado))
          }
          className="w-full py-4 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
        >
          Asignar Unidad
        </LoadingButton>
      </form>
    </Modal>
  )
}

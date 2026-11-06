import { useEffect, useState } from 'react'
import { useData } from '../../context/DataProvider'
import { usePagos } from '../../hooks/usePagos'
import { formatMonto, formatNombre } from '../../lib/format'
import { unidadConEmoji } from '../../lib/unidadIcono'
import { comprobanteTipoDefault, ERROR_EXCEDE_SALDO } from '../../lib/pagos'
import { usePagoComprobanteForm } from '../../hooks/usePagoComprobanteForm'
import Modal from './Modal'
import AvisoCajaCerrada from './AvisoCajaCerrada'
import PagoComprobanteCampos from './PagoComprobanteCampos'
import BrandSelect from '../ui/BrandSelect'
import { useDialog } from '../../context/DialogProvider'
import LoadingButton from '../ui/LoadingButton'
import MontoStat from '../ui/MontoStat'
import { CheckCircle2 } from 'lucide-react'
import { hoyAR } from '../../lib/fechas'

// Componente compartido de cobro (Tarea 4): Clientes, Reservas y el modal de
// unidad del Plano abren este mismo bottom sheet/drawer para registrar un
// pago. Un solo punto de escritura → registrar_pago (RPC), que asigna la
// caja abierta, valida saldo/bonificada, y crea el comprobante si vino
// incluido. Si la caja está cerrada, ofrece abrirla sin perder lo cargado.
// Los campos de monto/medio/comprobante viven en PagoComprobanteCampos +
// usePagoComprobanteForm (item 3/4, oct 2026) — mismo bloque que usa la
// sección de pago inline de Nueva Reserva/Asignar Unidad de Temporada.
export default function RegistrarPago({
  isOpen, onClose, cliente, reservasOptions = [], initialReservaId = '', allowSinReserva = true, onSuccess,
  // Oct 2026 (modal "Pago N.º X" → Cargar monto con datos completos): si
  // viene `editingPago`, el form se precarga con SUS datos (monto, medio,
  // tipo, fecha del recibo, comprobante) y el submit hace UPDATE sobre ese
  // pago (editarPagoCompleto), nunca un alta nueva. `tituloOverride`
  // permite mostrar "Recibo 1 de 2" durante el flujo secuencial de
  // notificaciones (ver Clientes.jsx) sin tocar el título por default.
  editingPago = null, tituloOverride = null,
}) {
  const { cajaHoy, registrarPago, editarPagoCompleto } = useData()
  const { alert, confirm } = useDialog()

  const [reservaId, setReservaId] = useState(initialReservaId)
  const [saving, setSaving] = useState(false)
  const [exito, setExito] = useState(null) // { monto } | null

  // usePagos(undefined) devuelve el historial COMPLETO (todas las reservas),
  // no "sin reserva" — hay que frenarlo a mano acá para no ofrecer "mismo
  // comprobante" con pagos de otro cliente.
  const { pagos: pagosDeReserva } = usePagos(reservaId || undefined)
  const pagosConComprobante = reservaId ? pagosDeReserva.filter((p) => p.comprobante_id && p.estado === 'vigente') : []

  const reservaSeleccionada = reservasOptions.find((r) => r.id === reservaId) || null
  const total = reservaSeleccionada ? Number(reservaSeleccionada.valor_total || 0) : 0
  // `reserva.saldo` es null cuando hay algún recibo sin monto verificado
  // (oct 2026, ver fn_pago_actualiza_saldo) — tratarlo como 0 acá mostraría
  // "Pagado" = el total entero y "Saldo" = $0, la mentira exacta que esto
  // vino a evitar (bug real, caso Sara Azcárate: parecía ya saldada).
  const saldoDesconocido = !!reservaSeleccionada && reservaSeleccionada.saldo == null
  const saldo = reservaSeleccionada && !saldoDesconocido ? Number(reservaSeleccionada.saldo || 0) : 0
  const pagado = saldoDesconocido ? null : Math.max(total - saldo, 0)
  const unidadLabel = reservaSeleccionada?.unidades
    ? unidadConEmoji(reservaSeleccionada.unidades.tipo, reservaSeleccionada.unidades.numero)
    : ''

  const form = usePagoComprobanteForm({
    resetKey: `${isOpen}-${initialReservaId}-${editingPago?.id || ''}`,
    cliente,
    reservaInfo: {
      total, saldo, saldoDesconocido, pagado, unidadLabel,
      temporadaOTipo: reservaSeleccionada?.temporada || reservaSeleccionada?.tipo_alquiler,
      sinReserva: !reservaSeleccionada,
    },
    pagosConComprobante,
  })
  const {
    monto, setMonto, medio, referencia, comprobanteTipo, setComprobanteTipo, numero, setNumero,
    fechaComprobante, setFechaComprobante, excedeSaldo, tipoPago, concepto, esHistorico,
    comprobanteIncompleto, construirComprobantePayload, duplicado,
    moneda, montoUsd, tipoCambio,
  } = form

  useEffect(() => {
    if (!isOpen) return
    setReservaId(initialReservaId || reservasOptions[0]?.id || '')
    setExito(null)

    if (editingPago) {
      // Precarga desde el pago existente — el comprobante que ya tiene
      // vinculado (si lo tiene) define tipo/número/fecha.
      const comprobanteExistente = editingPago.comprobantes?.[0] || null
      setMonto(editingPago.monto ?? 0)
      form.setMedio(editingPago.medio || 'efectivo')
      form.setReferencia(editingPago.referencia || '')
      setComprobanteTipo(comprobanteExistente?.tipo || comprobanteTipoDefault(cliente?.condicion_iva))
      setNumero(comprobanteExistente?.numero || '')
      // Fecha original del recibo, nunca "hoy" — si no hay fecha propia
      // cargada (migración), el mejor dato disponible es fecha_hora (el
      // timestamp de carga), nunca la fecha de hoy.
      setFechaComprobante(
        comprobanteExistente?.fecha || editingPago.fecha
          || (editingPago.fecha_hora ? editingPago.fecha_hora.slice(0, 10) : hoyAR())
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialReservaId, editingPago?.id])

  // Item 11 (testing oct 2026): el pago no afecta la caja DE HOY tanto si es
  // histórico (pre-corte) como si tiene una fecha de otro día post-corte —
  // en los dos casos impacta la caja de esa fecha, no la de hoy.
  const fechaPago = fechaComprobante || null
  const noAfectaCajaHoy = esHistorico || (fechaPago && fechaPago !== hoyAR())

  const submit = async (permitirExcedente = false) => {
    if (monto <= 0) return
    // Tarea 4.1: el monto por encima del saldo no se permite — el botón ya
    // queda deshabilitado por esto, esto es el freno defensivo si el saldo
    // cambió entre que se renderizó el form y que se envió.
    if (excedeSaldo && !permitirExcedente) return
    const tipoPagoFinal = tipoPago || 'parcial'

    if (editingPago) {
      setSaving(true)
      try {
        const pago = await editarPagoCompleto(editingPago.id, {
          monto, medio, tipoPago: tipoPagoFinal, fecha: fechaComprobante, comprobante: construirComprobantePayload(),
        })
        setExito({ monto, noAfectaCajaHoy, editado: true })
        onSuccess?.(pago)
      } catch (err) {
        await alert(err.message || 'No se pudo guardar el pago.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!cliente?.id) return
    if (!reservaId && !allowSinReserva) return

    setSaving(true)
    try {
      const pago = await registrarPago({
        clienteId: cliente.id, monto, medio, tipoPago: tipoPagoFinal, concepto,
        reservaId: reservaId || null, referencia, comprobante: construirComprobantePayload(),
        permitirExcedente, fecha: fechaPago,
        // USD: se manda el importe en dólares + la cotización; el equivalente
        // en pesos lo calcula el servidor (ver fn_registrar_pago_interno).
        moneda, montoOriginal: moneda === 'USD' ? montoUsd : null,
        tipoCambio: moneda === 'USD' ? tipoCambio : null,
      })
      setExito({ monto, noAfectaCajaHoy })
      onSuccess?.(pago)
    } catch (err) {
      if (err.code === ERROR_EXCEDE_SALDO) {
        const ok = await confirm(
          `El monto supera el saldo pendiente de la reserva (${formatMonto(saldo)}). ¿Registrar igual el excedente?`,
          { title: 'Monto mayor al saldo', tone: 'error' },
        )
        if (ok) return submit(true)
        return
      }
      await alert(err.message || 'No se pudo registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submit(false)
  }

  if (exito) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={tituloOverride || 'Registrar Pago'}>
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-success-soft border border-success/30 flex items-center justify-center">
            <CheckCircle2 className="text-success-ink" size={32} />
          </div>
          <div>
            <p className="text-card-title text-ink">{formatMonto(exito.monto)} {exito.editado ? 'guardado' : 'registrado'}</p>
            {/* Item 11 (testing oct 2026): se sacó el aviso para el caso
                normal (el pago SÍ afecta la caja de hoy — es lo esperable,
                no hace falta avisarlo). Solo queda el aviso cuando NO la
                afecta (histórico, o con fecha de otro día). */}
            {exito.noAfectaCajaHoy && (
              <p className="text-label text-ink-2 mt-1">
                El cobro ya está reflejado en la reserva. No impacta en la caja de hoy — queda imputado a la fecha del pago.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="text-label px-6 py-3 rounded-full bg-ink hover:bg-chart-2 transition-all text-on-ink"
            >
              Listo
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // Dirty check (Tarea 1, oct 2026): "¿escribió algo?" alcanza acá — no hay
  // un valor inicial distinto de 0/vacío para comparar, a diferencia de
  // Reservas.jsx que puede estar editando una reserva ya cargada.
  const esFormularioDirty = () =>
    Number(monto) > 0 || referencia.trim() !== '' || !!numero

  // Botón de confirmar como footer sticky del Modal (pulido mobile iPhone,
  // oct 2026) — antes vivía como último elemento del body scrolleable y
  // quedaba cortado por la barra de Safari en pantallas chicas. `form`
  // conecta el botón (fuera del <form> en el DOM, Modal lo renderiza en un
  // hermano) con el submit real via el atributo HTML form=id.
  const submitButton = (
    <LoadingButton
      type="submit"
      form="form-registrar-pago"
      loading={saving}
      loadingText="Guardando..."
      disabled={
        monto <= 0 || excedeSaldo || comprobanteIncompleto || !!duplicado
        || (!editingPago && !reservaId && !allowSinReserva) || (!editingPago && !cliente?.id)
      }
      className="text-label w-full py-4 bg-ink hover:bg-chart-2 rounded-full text-on-ink"
    >
      {editingPago
        ? `Guardar ${monto > 0 ? formatMonto(monto) : ''}`.trim()
        : esHistorico
          ? `Confirmar pago histórico ${monto > 0 ? formatMonto(monto) : ''}`.trim()
          : `Confirmar ${monto > 0 ? formatMonto(monto) : 'Pago'}`}
    </LoadingButton>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} isDirty={esFormularioDirty} title={tituloOverride || 'Registrar Pago'} footer={submitButton}>
      <form id="form-registrar-pago" onSubmit={handleSubmit} className="space-y-6">
        {/* Oct 2026: aviso proactivo, no solo reactivo al error P0003 al
            enviar — se ve apenas se abre el form, antes de cargar nada. Un
            pago con fecha histórica (comprobante con fecha anterior al
            1/10) nunca lo necesita, por eso se oculta solo si corresponde. */}
        {!cajaHoy && !esHistorico && <AvisoCajaCerrada />}

        {/* Reserva */}
        {reservasOptions.length > 1 || allowSinReserva ? (
          <div className="space-y-2">
            <label className="text-label text-ink-2">Reserva</label>
            <BrandSelect
              value={reservaId}
              onChange={setReservaId}
              options={[
                ...(allowSinReserva ? [{ value: '', label: 'Sin reserva — cobro directo al cliente' }] : []),
                ...reservasOptions.map((r) => ({
                  value: r.id,
                  // Reserva donde `cliente` es cosocio (no titular): se aclara
                  // de quién es la unidad, para que quede claro a nombre de
                  // quién se está cobrando (el pago igual queda con el
                  // cliente_id de `cliente`, el cosocio que abrió el form).
                  label: r.cliente_id && cliente?.id && r.cliente_id !== cliente.id
                    ? `${unidadConEmoji(r.unidades?.tipo, r.unidades?.numero)} (cosocio de ${formatNombre(r.clientes?.nombre) || 'otro cliente'}) — saldo ${formatMonto(r.saldo)}`
                    : `${unidadConEmoji(r.unidades?.tipo, r.unidades?.numero)} — saldo ${formatMonto(r.saldo)}`,
                })),
              ]}
            />
          </div>
        ) : reservaSeleccionada ? (
          <div className="p-4 bg-surface border border-line rounded-inner">
            <p className="text-label text-ink">{unidadLabel}</p>
          </div>
        ) : null}

        {/* Resumen */}
        {reservaSeleccionada && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 sm:p-3 bg-surface border border-line rounded-inner text-center min-w-0">
              <p className="text-label text-ink-2">Total</p>
              <MontoStat value={total} size="xs" className="text-ink mt-1" />
            </div>
            <div className="p-3 sm:p-3 bg-surface border border-line rounded-inner text-center min-w-0">
              <p className="text-label text-ink-2">Pagado</p>
              {saldoDesconocido ? (
                <p className="text-body font-semibold text-ink-2 normal-case mt-1">Sin verificar</p>
              ) : (
                <MontoStat value={pagado} size="xs" className="text-success-ink mt-1" />
              )}
            </div>
            <div className="p-3 sm:p-3 bg-surface border border-line rounded-inner text-center min-w-0">
              <p className="text-label text-ink-2">Saldo</p>
              {saldoDesconocido ? (
                <p className="text-body font-semibold text-ink-2 normal-case mt-1">Sin verificar</p>
              ) : (
                <MontoStat value={saldo} size="xs" className="text-ink mt-1" />
              )}
            </div>
          </div>
        )}

        <PagoComprobanteCampos form={form} />
      </form>
    </Modal>
  )
}

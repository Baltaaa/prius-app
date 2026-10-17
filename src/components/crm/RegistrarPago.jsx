import { useState, useEffect, useMemo } from 'react'
import { useData } from '../../context/DataProvider'
import { usePagos } from '../../hooks/usePagos'
import { supabase } from '../../lib/supabase'
import { formatPesos, formatFecha, unidadEmoji } from '../../lib/format'
import {
  MEDIO_PAGO_LABEL, TIPO_PAGO_LABEL, COMPROBANTE_TIPO_SIGLA, COMPROBANTE_TIPO_LABEL,
  calcularTipoPagoAutomatico, construirConceptoAutomatico, comprobanteTipoDefault,
  ERROR_EXCEDE_SALDO, esPagoHistorico,
} from '../../lib/pagos'
import Modal from './Modal'
import AvisoCajaCerrada from './AvisoCajaCerrada'
import MoneyInput from '../inputs/MoneyInput'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import BrandSelect from '../ui/BrandSelect'
import { useDialog } from '../../context/DialogProvider'
import LoadingButton from '../ui/LoadingButton'
import { CheckCircle2 } from 'lucide-react'

const inputClass =
  'w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-base md:text-sm focus:border-gold/50 outline-none font-bold'

const chipClass = (active) =>
  `px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-gold text-black border-gold' : 'bg-prius-subtle text-prius-slate border-hairline hover:text-black'
  }`

// Componente compartido de cobro (Tarea 4): Clientes, Reservas y el modal de
// unidad del Plano abren este mismo bottom sheet/drawer para registrar un
// pago. Un solo punto de escritura → registrar_pago (RPC), que asigna la
// caja abierta, valida saldo/bonificada, y crea el comprobante si vino
// incluido. Si la caja está cerrada, ofrece abrirla sin perder lo cargado.
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
  const [monto, setMonto] = useState(0)
  const [medio, setMedio] = useState('efectivo')
  const [referencia, setReferencia] = useState('')

  // Comprobante (oct 2026, Tarea 4.2): ya no es "lo cargo después" — el
  // bloque siempre está abierto y es obligatorio para poder confirmar.
  const [comprobanteTipo, setComprobanteTipo] = useState('factura_b')
  const [puntoVenta, setPuntoVenta] = useState(1)
  const [numero, setNumero] = useState(null)
  const [fechaComprobante, setFechaComprobante] = useState(() => new Date().toISOString().split('T')[0])
  const [mismoComprobanteDe, setMismoComprobanteDe] = useState('')
  // Duplicado (Tarea 4.5): se chequea al salir del campo "Número" contra
  // (tipo, punto_venta, numero) en la base — evita el 409 silencioso de
  // completar_comprobante (constraint comprobantes_tipo_punto_venta_numero_key).
  const [duplicado, setDuplicado] = useState(null) // { cliente, fecha } | null
  const [verificandoDuplicado, setVerificandoDuplicado] = useState(false)

  const [saving, setSaving] = useState(false)
  const [exito, setExito] = useState(null) // { monto } | null

  // usePagos(undefined) devuelve el historial COMPLETO (todas las reservas),
  // no "sin reserva" — hay que frenarlo a mano acá para no ofrecer "mismo
  // comprobante" con pagos de otro cliente.
  const { pagos: pagosDeReserva } = usePagos(reservaId || undefined)
  const pagosConComprobante = reservaId ? pagosDeReserva.filter((p) => p.comprobante_id && p.estado === 'vigente') : []

  useEffect(() => {
    if (!isOpen) return
    setReservaId(initialReservaId || reservasOptions[0]?.id || '')
    setExito(null)
    setDuplicado(null)

    if (editingPago) {
      // Precarga desde el pago existente — el comprobante que ya tiene
      // vinculado (si lo tiene) define tipo/punto de venta/número/fecha.
      // Un recibo sin monto de la migración siempre viene con un
      // comprobante real (si no, es una fila fantasma, ver `esPagoReal` en
      // lib/reservas.js) — pero por las dudas no asumimos que exista.
      const comprobanteExistente = editingPago.comprobantes?.[0] || null
      setMonto(editingPago.monto ?? 0)
      setMedio(editingPago.medio || 'efectivo')
      setReferencia(editingPago.referencia || '')
      setComprobanteTipo(comprobanteExistente?.tipo || comprobanteTipoDefault(cliente?.condicion_iva))
      setPuntoVenta(comprobanteExistente?.punto_venta || 1)
      setNumero(comprobanteExistente?.numero || '')
      // Fecha original del recibo, nunca "hoy" — si no hay fecha propia
      // cargada (migración), el mejor dato disponible es fecha_hora (el
      // timestamp de carga), nunca la fecha de hoy.
      setFechaComprobante(
        comprobanteExistente?.fecha || editingPago.fecha
          || (editingPago.fecha_hora ? editingPago.fecha_hora.slice(0, 10) : new Date().toISOString().split('T')[0])
      )
      setMismoComprobanteDe('')
      return
    }

    setMonto(0)
    setMedio('efectivo')
    setReferencia('')
    setComprobanteTipo(comprobanteTipoDefault(cliente?.condicion_iva))
    setPuntoVenta(1)
    setNumero('')
    setFechaComprobante(new Date().toISOString().split('T')[0])
    setMismoComprobanteDe('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialReservaId, editingPago?.id])

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
    ? `${unidadEmoji(reservaSeleccionada.unidades.tipo)} ${reservaSeleccionada.unidades.tipo} #${reservaSeleccionada.unidades.numero}`
    : ''

  // Tipo y concepto automáticos (Tarea 4.1, oct 2026): ya no hay selects
  // manuales — se calculan solos a partir del saldo de la reserva.
  const excedeSaldo = !!reservaSeleccionada && !saldoDesconocido && Number(monto) > saldo
  const tipoPago = excedeSaldo ? null : calcularTipoPagoAutomatico({
    monto, saldo, costoTotal: total, huboPagosPrevios: !saldoDesconocido && pagado > 0,
    saldoDesconocido, sinReserva: !reservaSeleccionada,
  })
  const tipoLabel = tipoPago ? (TIPO_PAGO_LABEL[tipoPago] || 'Pago') : null
  const concepto = useMemo(() => construirConceptoAutomatico({
    tipoLabel: tipoLabel || 'Pago',
    unidadLabel,
    temporadaOTipo: reservaSeleccionada?.temporada || reservaSeleccionada?.tipo_alquiler,
    clienteNombre: cliente?.nombre,
  }), [tipoLabel, unidadLabel, reservaSeleccionada, cliente])

  // La fecha del comprobante define la fecha del pago (comprobante siempre
  // obligatorio desde oct 2026, Tarea 4.2 — ya no hay "lo cargo después").
  // Anterior al inicio de la caja digital = histórico: no exige caja
  // abierta, nunca entra a ningún resumen de caja (ver lib/pagos.js).
  const fechaPago = fechaComprobante || null
  const esHistorico = esPagoHistorico(fechaPago)

  // Comprobante obligatorio (Tarea 4.2) salvo que se eligió "mismo
  // comprobante que otro pago" — ahí el bloque de datos ya no aplica.
  const comprobanteIncompleto = !mismoComprobanteDe && (!comprobanteTipo || !puntoVenta || !numero || !fechaComprobante)

  const construirComprobantePayload = () => {
    if (mismoComprobanteDe) return { comprobante_id: mismoComprobanteDe }
    if (!comprobanteTipo || !puntoVenta || !numero) return null
    return { tipo: comprobanteTipo, punto_venta: puntoVenta, numero, fecha: fechaComprobante }
  }

  // Duplicado (Tarea 4.5): chequea (tipo, punto_venta, numero) contra
  // `comprobantes` al salir del campo "Número" — antes esto lo detectaba
  // recién el RPC con un 409 genérico (constraint
  // comprobantes_tipo_punto_venta_numero_key) y el pago quedaba sin
  // comprobante asociado.
  const verificarDuplicado = async () => {
    setDuplicado(null)
    if (mismoComprobanteDe || !comprobanteTipo || !puntoVenta || !numero) return
    setVerificandoDuplicado(true)
    try {
      const { data } = await supabase
        .from('comprobantes')
        .select('fecha, clientes(nombre)')
        .eq('tipo', comprobanteTipo)
        .eq('punto_venta', puntoVenta)
        .eq('numero', String(numero))
        .maybeSingle()
      if (data) setDuplicado({ cliente: data.clientes?.nombre || 'otro cliente', fecha: data.fecha })
    } finally {
      setVerificandoDuplicado(false)
    }
  }

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
        setExito({ monto, historico: esHistorico, editado: true })
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
      })
      setExito({ monto, historico: esHistorico })
      onSuccess?.(pago)
    } catch (err) {
      if (err.code === ERROR_EXCEDE_SALDO) {
        const ok = await confirm(
          `El monto supera el saldo pendiente de la reserva (${formatPesos(saldo)}). ¿Registrar igual el excedente?`,
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
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="text-prius-success" size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-black">{formatPesos(exito.monto)} {exito.editado ? 'guardado' : 'registrado'}</p>
            <p className="text-xs text-prius-slate uppercase tracking-widest mt-1">
              {exito.historico
                ? 'El cobro ya está reflejado en la reserva. Pago histórico: no impacta en la caja diaria.'
                : 'El cobro ya está reflejado en la reserva y en la caja de hoy.'}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-gold text-black hover:bg-yellow-300 transition-all"
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} isDirty={esFormularioDirty} title={tituloOverride || 'Registrar Pago'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Oct 2026: aviso proactivo, no solo reactivo al error P0003 al
            enviar — se ve apenas se abre el form, antes de cargar nada. Un
            pago con fecha histórica (comprobante con fecha anterior al
            1/10) nunca lo necesita, por eso se oculta solo si corresponde. */}
        {!cajaHoy && !esHistorico && <AvisoCajaCerrada />}

        {/* 1. Reserva */}
        {reservasOptions.length > 1 || allowSinReserva ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Reserva</label>
            <BrandSelect
              value={reservaId}
              onChange={setReservaId}
              options={[
                ...(allowSinReserva ? [{ value: '', label: 'Sin reserva — cobro directo al cliente' }] : []),
                ...reservasOptions.map((r) => ({
                  value: r.id,
                  label: `${unidadEmoji(r.unidades?.tipo)} ${r.unidades?.tipo} #${r.unidades?.numero} — saldo ${formatPesos(r.saldo)}`,
                })),
              ]}
            />
          </div>
        ) : reservaSeleccionada ? (
          <div className="p-4 bg-prius-subtle border border-hairline rounded-xl">
            <p className="text-sm font-bold text-black uppercase">{unidadLabel}</p>
          </div>
        ) : null}

        {/* 2. Resumen */}
        {reservaSeleccionada && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-prius-subtle border border-hairline rounded-xl text-center">
              <p className="text-[9px] text-prius-muted uppercase tracking-widest">Total</p>
              <p className="text-sm font-bold text-black mt-1">{formatPesos(total)}</p>
            </div>
            <div className="p-3 bg-prius-subtle border border-hairline rounded-xl text-center">
              <p className="text-[9px] text-prius-muted uppercase tracking-widest">Pagado</p>
              <p className="text-sm font-bold text-prius-success mt-1">
                {saldoDesconocido ? <span className="text-prius-slate normal-case">Sin verificar</span> : formatPesos(pagado)}
              </p>
            </div>
            <div className="p-3 bg-prius-subtle border border-hairline rounded-xl text-center">
              <p className="text-[9px] text-prius-muted uppercase tracking-widest">Saldo</p>
              <p className="text-sm font-bold text-gold mt-1">
                {saldoDesconocido ? <span className="text-prius-slate normal-case">Sin verificar</span> : formatPesos(saldo)}
              </p>
            </div>
          </div>
        )}

        {/* 3. Monto */}
        <div>
          <MoneyInput
            label="Monto"
            value={monto}
            onChange={setMonto}
            required
            max={100_000_000}
            error={excedeSaldo ? `El monto supera el saldo pendiente (${formatPesos(saldo)})` : undefined}
            chips={reservaSeleccionada && !saldoDesconocido && saldo > 0 ? [
              { label: 'Saldo total', value: saldo },
              { label: '50%', value: Math.round(saldo / 2) },
            ] : undefined}
          />
          {/* Vista previa en vivo (Tarea 4.1, oct 2026): tipo/concepto ya no
              se eligen a mano, se calculan solos — esto es lo único que el
              usuario ve de esa decisión antes de confirmar. */}
          {!excedeSaldo && Number(monto) > 0 && (
            <p className="text-[11px] text-prius-slate mt-1.5">
              Se registrará como: <span className="text-prius-slate font-semibold">{tipoLabel}</span>
              {reservaSeleccionada && !saldoDesconocido && (
                <> — saldo restante {formatPesos(Math.max(saldo - Number(monto), 0))}</>
              )}
              {saldoDesconocido && <span className="text-amber-400"> · Saldo sin verificar</span>}
            </p>
          )}
        </div>

        {/* 4. Medio de pago + referencia */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Medio de pago</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMedio(value)} className={chipClass(medio === value)}>{label}</button>
            ))}
          </div>
          {medio !== 'efectivo' && (
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="N.° de operación / referencia (opcional)"
              className={inputClass}
            />
          )}
        </div>

        {/* 5. Comprobante — obligatorio desde oct 2026 (Tarea 4.2), siempre
            visible, ya no hay "lo cargo después". */}
        <div className="border border-hairline rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-prius-subtle text-xs font-bold uppercase tracking-widest text-prius-slate">
            Comprobante
          </div>
          <div className="p-4 space-y-4 bg-black/20">
            {pagosConComprobante.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Mismo comprobante que otro pago</label>
                <BrandSelect
                  value={mismoComprobanteDe}
                  onChange={setMismoComprobanteDe}
                  options={[
                    { value: '', label: 'No — es un comprobante nuevo' },
                    ...pagosConComprobante.map((p) => ({
                      value: p.comprobante_id,
                      label: `Cuota ${p.nro_cuota} — ${formatPesos(p.monto)}`,
                    })),
                  ]}
                />
              </div>
            )}
            {!mismoComprobanteDe && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Tipo</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(COMPROBANTE_TIPO_SIGLA).map(([value, sigla]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setComprobanteTipo(value); setDuplicado(null) }}
                        title={COMPROBANTE_TIPO_LABEL[value]}
                        className={chipClass(comprobanteTipo === value)}
                      >
                        {sigla}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <IntegerInput
                    label="Punto de venta" value={puntoVenta} onChange={(v) => { setPuntoVenta(v); setDuplicado(null) }}
                    onBlur={verificarDuplicado} min={1} max={99999}
                    placeholder="Ej: 1" error={comprobanteIncompleto && !puntoVenta ? 'Obligatorio' : undefined}
                  />
                  <IntegerInput
                    label="Número" value={numero} onChange={(v) => { setNumero(v); setDuplicado(null) }}
                    onBlur={verificarDuplicado} min={1} max={99999999}
                    placeholder="Ej: 727" error={comprobanteIncompleto && !numero ? 'Obligatorio' : undefined}
                  />
                </div>
                {verificandoDuplicado && <p className="text-[11px] text-prius-muted">Verificando...</p>}
                {duplicado && (
                  <p className="text-[11px] text-prius-error">
                    Ese comprobante ya está cargado ({duplicado.cliente}{duplicado.fecha ? `, ${formatFecha(duplicado.fecha)}` : ''}).
                  </p>
                )}
                <DateInput
                  label="Fecha"
                  value={fechaComprobante}
                  onChange={setFechaComprobante}
                  max={new Date().toISOString().split('T')[0]}
                  calendarOnly
                  hint={esHistorico ? 'Pago histórico: queda en el historial del cliente, no afecta la caja' : undefined}
                />
                {comprobanteIncompleto && (
                  <p className="text-[11px] text-prius-error">
                    El comprobante es obligatorio: completá tipo, punto de venta, número y fecha.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Guardando..."
          disabled={
            monto <= 0 || excedeSaldo || comprobanteIncompleto || !!duplicado
            || (!editingPago && !reservaId && !allowSinReserva) || (!editingPago && !cliente?.id)
          }
          className="w-full py-4 bg-gold hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs shadow-xl"
        >
          {editingPago
            ? `Guardar ${monto > 0 ? formatPesos(monto) : ''}`.trim()
            : esHistorico
              ? `Confirmar pago histórico ${monto > 0 ? formatPesos(monto) : ''}`.trim()
              : `Confirmar ${monto > 0 ? formatPesos(monto) : 'Pago'}`}
        </LoadingButton>
      </form>
    </Modal>
  )
}

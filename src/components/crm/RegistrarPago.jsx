import { useState, useEffect } from 'react'
import { useData } from '../../context/DataProvider'
import { usePagos } from '../../hooks/usePagos'
import { formatPesos, unidadEmoji } from '../../lib/format'
import {
  MEDIO_PAGO_LABEL, TIPO_PAGO_LABEL, COMPROBANTE_TIPO_SIGLA, COMPROBANTE_TIPO_LABEL,
  sugerirTipoPago, comprobanteTipoDefault, ERROR_CAJA_CERRADA, ERROR_EXCEDE_SALDO, esPagoHistorico,
} from '../../lib/pagos'
import Modal from './Modal'
import MoneyInput from '../inputs/MoneyInput'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import BrandSelect from '../ui/BrandSelect'
import { useDialog } from '../../context/DialogProvider'
import { CheckCircle2, ChevronDown, Wallet } from 'lucide-react'

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold'

const chipClass = (active) =>
  `px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-[#FDE047] text-black border-[#FDE047]' : 'bg-white/5 text-gray-300 border-white/10 hover:text-white'
  }`

// Componente compartido de cobro (Tarea 4): Clientes, Reservas y el modal de
// unidad del Plano abren este mismo bottom sheet/drawer para registrar un
// pago. Un solo punto de escritura → registrar_pago (RPC), que asigna la
// caja abierta, valida saldo/bonificada, y crea el comprobante si vino
// incluido. Si la caja está cerrada, ofrece abrirla sin perder lo cargado.
export default function RegistrarPago({
  isOpen, onClose, cliente, reservasOptions = [], initialReservaId = '', allowSinReserva = true, onSuccess,
}) {
  const { iniciarCaja, registrarPago } = useData()
  const { alert, confirm } = useDialog()

  const [reservaId, setReservaId] = useState(initialReservaId)
  const [monto, setMonto] = useState(0)
  const [medio, setMedio] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [tipoPago, setTipoPago] = useState('sena')
  const [tipoPagoTouched, setTipoPagoTouched] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [conceptoTouched, setConceptoTouched] = useState(false)

  const [comprobanteAbierto, setComprobanteAbierto] = useState(false)
  const [comprobanteTipo, setComprobanteTipo] = useState('factura_b')
  const [puntoVenta, setPuntoVenta] = useState(1)
  const [numero, setNumero] = useState(null)
  const [fechaComprobante, setFechaComprobante] = useState(() => new Date().toISOString().split('T')[0])
  const [mismoComprobanteDe, setMismoComprobanteDe] = useState('')

  const [saving, setSaving] = useState(false)
  const [exito, setExito] = useState(null) // { monto } | null
  const [cajaCerrada, setCajaCerrada] = useState(false)
  const [montoApertura, setMontoApertura] = useState(null)
  const [abriendoCaja, setAbriendoCaja] = useState(false)

  // usePagos(undefined) devuelve el historial COMPLETO (todas las reservas),
  // no "sin reserva" — hay que frenarlo a mano acá para no ofrecer "mismo
  // comprobante" con pagos de otro cliente.
  const { pagos: pagosDeReserva } = usePagos(reservaId || undefined)
  const pagosConComprobante = reservaId ? pagosDeReserva.filter((p) => p.comprobante_id && p.estado === 'vigente') : []

  useEffect(() => {
    if (!isOpen) return
    setReservaId(initialReservaId || reservasOptions[0]?.id || '')
    setMonto(0)
    setMedio('efectivo')
    setReferencia('')
    setTipoPago('sena')
    setTipoPagoTouched(false)
    setConcepto('')
    setConceptoTouched(false)
    setComprobanteAbierto(false)
    setComprobanteTipo(comprobanteTipoDefault(cliente?.condicion_iva))
    setPuntoVenta(1)
    setNumero('')
    setFechaComprobante(new Date().toISOString().split('T')[0])
    setMismoComprobanteDe('')
    setExito(null)
    setCajaCerrada(false)
    setMontoApertura('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialReservaId])

  const reservaSeleccionada = reservasOptions.find((r) => r.id === reservaId) || null
  const total = reservaSeleccionada ? Number(reservaSeleccionada.valor_total || 0) : 0
  const saldo = reservaSeleccionada ? Number(reservaSeleccionada.saldo || 0) : 0
  const pagado = Math.max(total - saldo, 0)

  const unidadLabel = reservaSeleccionada?.unidades
    ? `${unidadEmoji(reservaSeleccionada.unidades.tipo)} ${reservaSeleccionada.unidades.tipo} #${reservaSeleccionada.unidades.numero}`
    : ''

  // Sugerencias de tipo de pago / concepto — solo mientras el usuario no las
  // haya tocado a mano, para no pisar una edición intencional.
  useEffect(() => {
    if (tipoPagoTouched) return
    setTipoPago(sugerirTipoPago(monto, saldo, pagado))
  }, [monto, saldo, pagado, tipoPagoTouched])

  useEffect(() => {
    if (conceptoTouched) return
    const label = TIPO_PAGO_LABEL[tipoPago] || 'Pago'
    if (reservaSeleccionada) {
      setConcepto(`${label} · ${unidadLabel} · ${reservaSeleccionada.temporada || reservaSeleccionada.tipo_alquiler || ''}`.replace(/\s+·\s*$/, ''))
    } else if (cliente) {
      setConcepto(`${label} · ${cliente.nombre || ''}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPago, reservaId, conceptoTouched])

  const esperandoCaja = cajaCerrada

  // La fecha del comprobante define la fecha del pago (si no hay comprobante
  // cargado todavía, es un cobro de hoy en vivo — comportamiento de siempre).
  // Anterior al inicio de la caja digital = histórico: no exige caja
  // abierta, nunca entra a ningún resumen de caja (ver lib/pagos.js).
  const fechaPago = comprobanteAbierto && fechaComprobante ? fechaComprobante : null
  const esHistorico = esPagoHistorico(fechaPago)

  // Con el acordeón abierto y sin elegir "mismo comprobante que otro pago",
  // punto de venta y número son obligatorios — si no, el pago se registraba
  // igual pero sin comprobante, sin ningún aviso (bug reportado: el usuario
  // creía haber cargado un comprobante y no quedaba asociado a nada).
  const comprobanteIncompleto = comprobanteAbierto && !mismoComprobanteDe && (!comprobanteTipo || !puntoVenta || !numero)

  const construirComprobantePayload = () => {
    if (!comprobanteAbierto) return null
    if (mismoComprobanteDe) return { comprobante_id: mismoComprobanteDe }
    if (!comprobanteTipo || !puntoVenta || !numero) return null
    return { tipo: comprobanteTipo, punto_venta: puntoVenta, numero, fecha: fechaComprobante }
  }

  const submit = async (permitirExcedente = false) => {
    if (!cliente?.id) return
    if (!reservaId && !allowSinReserva) return
    if (monto <= 0) return

    setSaving(true)
    try {
      const pago = await registrarPago({
        clienteId: cliente.id, monto, medio, tipoPago, concepto,
        reservaId: reservaId || null, referencia, comprobante: construirComprobantePayload(),
        permitirExcedente, fecha: fechaPago,
      })
      setExito({ monto, historico: esHistorico })
      onSuccess?.(pago)
    } catch (err) {
      if (err.code === ERROR_CAJA_CERRADA) {
        setCajaCerrada(true)
        return
      }
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

  const handleAbrirCajaYReintentar = async () => {
    setAbriendoCaja(true)
    try {
      await iniciarCaja(montoApertura || 0)
      setCajaCerrada(false)
      await submit()
    } catch (err) {
      await alert(err.message || 'No se pudo abrir la caja.')
    } finally {
      setAbriendoCaja(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submit(false)
  }

  if (exito) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pago">
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="text-green-400" size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{formatPesos(exito.monto)} registrado</p>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
              {exito.historico
                ? 'El cobro ya está reflejado en la reserva. Pago histórico: no impacta en la caja diaria.'
                : 'El cobro ya está reflejado en la reserva y en la caja de hoy.'}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#FDE047] text-black hover:bg-yellow-300 transition-all"
            >
              Listo
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  if (esperandoCaja) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="La caja está cerrada">
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 bg-[#FDE047]/5 border border-[#FDE047]/20 rounded-xl">
            <Wallet className="text-[#FDE047] shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-gray-300">
              No hay una caja abierta hoy. Lo que cargaste no se perdió — abrí la caja y el cobro se registra solo.
            </p>
          </div>
          <MoneyInput label="Monto inicial de caja" value={montoApertura} onChange={setMontoApertura} max={10_000_000} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCajaCerrada(false)}
              className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all"
            >
              Volver
            </button>
            <button
              type="button"
              disabled={abriendoCaja}
              onClick={handleAbrirCajaYReintentar}
              className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#FDE047] text-black hover:bg-yellow-300 disabled:opacity-50 transition-all"
            >
              {abriendoCaja ? 'Abriendo...' : 'Abrir caja y cobrar'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pago">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Reserva */}
        {reservasOptions.length > 1 || allowSinReserva ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reserva</label>
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
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm font-bold text-white uppercase">{unidadLabel}</p>
          </div>
        ) : null}

        {/* 2. Resumen */}
        {reservaSeleccionada && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">Total</p>
              <p className="text-sm font-bold text-white mt-1">{formatPesos(total)}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">Pagado</p>
              <p className="text-sm font-bold text-green-400 mt-1">{formatPesos(pagado)}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">Saldo</p>
              <p className="text-sm font-bold text-[#FDE047] mt-1">{formatPesos(saldo)}</p>
            </div>
          </div>
        )}

        {/* 3. Monto */}
        <MoneyInput
          label="Monto"
          value={monto}
          onChange={setMonto}
          required
          max={100_000_000}
          chips={reservaSeleccionada && saldo > 0 ? [
            { label: 'Saldo total', value: saldo },
            { label: '50%', value: Math.round(saldo / 2) },
          ] : undefined}
        />

        {/* 4. Medio de pago + referencia */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Medio de pago</label>
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

        {/* 5. Tipo de pago + concepto */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tipo</label>
            <BrandSelect
              value={tipoPago}
              onChange={(v) => { setTipoPago(v); setTipoPagoTouched(true) }}
              options={Object.entries(TIPO_PAGO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Concepto</label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => { setConcepto(e.target.value); setConceptoTouched(true) }}
              className={inputClass}
            />
          </div>
        </div>

        {/* 6. Comprobante (colapsable) */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setComprobanteAbierto((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 text-xs font-bold uppercase tracking-widest text-gray-300"
          >
            {comprobanteAbierto ? 'Cargar comprobante ahora' : 'Lo cargo después'}
            <ChevronDown size={16} className={`transition-transform ${comprobanteAbierto ? 'rotate-180' : ''}`} />
          </button>
          {comprobanteAbierto && (
            <div className="p-4 space-y-4 bg-black/20">
              {pagosConComprobante.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mismo comprobante que otro pago</label>
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tipo</label>
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <IntegerInput
                      label="Punto de venta" value={puntoVenta} onChange={setPuntoVenta} min={1} max={99999}
                      placeholder="Ej: 1" error={comprobanteIncompleto && !puntoVenta ? 'Obligatorio' : undefined}
                    />
                    <IntegerInput
                      label="Número" value={numero} onChange={setNumero} min={1} max={99999999}
                      placeholder="Ej: 727" error={comprobanteIncompleto && !numero ? 'Obligatorio' : undefined}
                    />
                  </div>
                  <DateInput
                    label="Fecha"
                    value={fechaComprobante}
                    onChange={setFechaComprobante}
                    max={new Date().toISOString().split('T')[0]}
                    calendarOnly
                    hint={esHistorico ? 'Pago histórico · no impacta en la caja diaria' : undefined}
                  />
                  {comprobanteIncompleto && (
                    <p className="text-[11px] text-red-400">
                      Completá punto de venta y número, o cerrá "Cargar comprobante ahora" si lo vas a cargar después — si no, el pago se registra sin comprobante asociado.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || monto <= 0 || (!reservaId && !allowSinReserva) || !cliente?.id || comprobanteIncompleto}
          className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
        >
          {saving
            ? 'Registrando...'
            : esHistorico
              ? `Confirmar pago histórico ${monto > 0 ? formatPesos(monto) : ''}`.trim()
              : `Confirmar ${monto > 0 ? formatPesos(monto) : 'Pago'}`}
        </button>
      </form>
    </Modal>
  )
}

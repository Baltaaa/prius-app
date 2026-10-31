import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTipoCambio, usdAPesos } from './useTipoCambio'
import {
  calcularTipoPagoAutomatico, construirConceptoAutomatico, comprobanteTipoDefault, esPagoHistorico,
} from '../lib/pagos'

// Estado + validación del bloque "monto, medio de pago y comprobante" —
// extraído de RegistrarPago.jsx (item 4/3, oct 2026) para que Registrar
// Pago Y la sección de pago inline de Nueva Reserva/Asignar Unidad de
// Temporada compartan exactamente la misma lógica (nunca duplicada), solo
// cambia quién la monta: un <Modal> propio o una columna del formulario.
//
// `resetKey` (cualquier valor que cambie cuando el form "se abre de
// nuevo" — isOpen de un modal, o el id de la reserva en edición): cuando
// cambia, reinicia a los defaults. `cliente`/`reservaInfo` alimentan los
// cálculos automáticos (tipo de pago, concepto) igual que antes.
export function usePagoComprobanteForm({ resetKey, cliente, reservaInfo, pagosConComprobante = [] }) {
  const [monto, setMonto] = useState(0)
  // Pagos en USD (31/10/2026). `monto` SIGUE siendo siempre el importe en
  // PESOS: es lo que miran todas las validaciones de abajo (excedeSaldo,
  // tipoPago, concepto) y lo que imputa el servidor al saldo. Cuando la
  // moneda es USD, el usuario edita `montoUsd` y `monto` pasa a ser un
  // derivado (montoUsd x cotización) — así no hubo que tocar ninguna de esas
  // validaciones. Al enviar, igual se manda el importe en dólares y el
  // servidor recalcula: el front nunca dicta el monto en pesos.
  const [moneda, setMoneda] = useState('ARS')
  const [montoUsd, setMontoUsd] = useState(0)
  const [tipoCambioManual, setTipoCambioManual] = useState(null)
  const tc = useTipoCambio()
  const tipoCambio = tipoCambioManual ?? tc.valor
  const montoArsEquivalente = usdAPesos(montoUsd, tipoCambio)

  useEffect(() => {
    if (moneda !== 'USD') return
    setMonto(montoArsEquivalente || 0)
  }, [moneda, montoArsEquivalente])

  const [medio, setMedio] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [comprobanteTipo, setComprobanteTipo] = useState('factura_b')
  const [puntoVenta] = useState(1) // siempre 1, automático — no se edita (item 4, oct 2026)
  const [numero, setNumero] = useState('')
  const [fechaComprobante, setFechaComprobante] = useState(() => new Date().toISOString().split('T')[0])
  const [mismoComprobanteDe, setMismoComprobanteDe] = useState('')
  const [duplicado, setDuplicado] = useState(null) // { cliente, fecha } | null
  const [anuladoPrevio, setAnuladoPrevio] = useState(false)
  const [verificandoDuplicado, setVerificandoDuplicado] = useState(false)

  useEffect(() => {
    setMonto(0)
    setMoneda('ARS')
    setMontoUsd(0)
    setTipoCambioManual(null)
    setMedio('efectivo')
    setReferencia('')
    setComprobanteTipo(comprobanteTipoDefault(cliente?.condicion_iva))
    setNumero('')
    setFechaComprobante(new Date().toISOString().split('T')[0])
    setMismoComprobanteDe('')
    setDuplicado(null)
    setAnuladoPrevio(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const { total = 0, saldo = 0, saldoDesconocido = false, pagado = 0, unidadLabel = '', temporadaOTipo = '', sinReserva = false } = reservaInfo || {}

  const excedeSaldo = !sinReserva && !saldoDesconocido && Number(monto) > saldo
  const tipoPago = excedeSaldo ? null : calcularTipoPagoAutomatico({
    monto, saldo, costoTotal: total, huboPagosPrevios: !saldoDesconocido && pagado > 0, saldoDesconocido, sinReserva,
  })
  const concepto = useMemo(() => construirConceptoAutomatico({
    tipoLabel: tipoPago || 'Pago', unidadLabel, temporadaOTipo, clienteNombre: cliente?.nombre,
  }), [tipoPago, unidadLabel, temporadaOTipo, cliente])

  const fechaPago = fechaComprobante || null
  const esHistorico = esPagoHistorico(fechaPago)

  const comprobanteIncompleto = !mismoComprobanteDe && (!comprobanteTipo || !puntoVenta || !numero || !fechaComprobante)

  const construirComprobantePayload = () => {
    if (mismoComprobanteDe) return { comprobante_id: mismoComprobanteDe }
    if (!comprobanteTipo || !puntoVenta || !numero) return null
    return { tipo: comprobanteTipo, punto_venta: puntoVenta, numero, fecha: fechaComprobante }
  }

  // Duplicado (oct 2026): un comprobante anulado no bloquea — ver item 5,
  // migración comprobantes_unicidad_solo_vigentes. Si el único match es un
  // anulado, solo se avisa (sin bloquear).
  const verificarDuplicado = async () => {
    setDuplicado(null)
    setAnuladoPrevio(false)
    if (mismoComprobanteDe || !comprobanteTipo || !puntoVenta || !numero) return
    setVerificandoDuplicado(true)
    try {
      const { data } = await supabase
        .from('comprobantes')
        .select('fecha, estado, clientes(nombre)')
        .eq('tipo', comprobanteTipo)
        .eq('punto_venta', puntoVenta)
        .eq('numero', String(numero))
      const vigente = (data || []).find((c) => c.estado !== 'anulado')
      if (vigente) {
        setDuplicado({ cliente: vigente.clientes?.nombre || 'otro cliente', fecha: vigente.fecha })
      } else if ((data || []).length > 0) {
        setAnuladoPrevio(true)
      }
    } finally {
      setVerificandoDuplicado(false)
    }
  }

  const limpiarDuplicado = () => { setDuplicado(null); setAnuladoPrevio(false) }

  return {
    monto, setMonto,
    moneda, setMoneda, montoUsd, setMontoUsd,
    tipoCambio, setTipoCambioManual, tipoCambioManual,
    cotizacionDelDia: tc.valor, cotizacionStale: tc.stale, cotizacionFecha: tc.fecha,
    cotizacionTipo: tc.tipo, cotizacionLado: tc.lado,
    montoArsEquivalente, medio, setMedio, referencia, setReferencia,
    comprobanteTipo, setComprobanteTipo, puntoVenta, numero, setNumero,
    fechaComprobante, setFechaComprobante, mismoComprobanteDe, setMismoComprobanteDe,
    duplicado, anuladoPrevio, verificandoDuplicado, verificarDuplicado, limpiarDuplicado,
    excedeSaldo, tipoPago, concepto, esHistorico, comprobanteIncompleto, construirComprobantePayload,
    pagosConComprobante, saldo, saldoDesconocido, total, pagado,
  }
}

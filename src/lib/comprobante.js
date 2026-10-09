import { formatMedioPago } from './pagos'
import { montoInfo, saldoNumerico, pagoSinVerificar, tienePagoSinVerificar, esPendienteConfirmacion } from './reservas'

// Numeración actual: slice del uuid de la reserva (REC-DBC079A1), igual que
// antes del rediseño — la numeración correlativa por temporada (REC-2627-
// 000123, generada en Postgres) queda propuesta en SQL para el PASO 4, sin
// aplicar todavía. Este helper es el único lugar que la arma, para poder
// reemplazarlo por el RPC sin tocar el resto del módulo.
export function numeroComprobante(reserva) {
  return reserva?.numero_factura || `REC-${String(reserva?.id || '').slice(0, 8).toUpperCase()}`
}

function mapPago(p) {
  return {
    id: p.id,
    fecha: p.fecha,
    medioLabel: formatMedioPago(p),
    comprobante: p.comprobante || null,
    nroCuota: p.nro_cuota || null,
    monto: p.monto,
    sinVerificar: pagoSinVerificar(p),
  }
}

/**
 * Arma los props de `ComprobanteDocumento` a partir de la reserva (con
 * `clientes`/`unidades` embebidos, igual que las trae `useReservas`) y sus
 * pagos. Nunca lee `reserva.valor_total`/`reserva.saldo` crudos — misma
 * regla que `MontoReserva`/`SaldoReserva` (ver `lib/reservas.js`), para que
 * el comprobante nunca contradiga lo que ya se ve en Clientes/Reservas.
 */
export function armarDatosComprobante({ reserva, pagos, perfil, tipo = 'estado_cuenta', pagoId = null }) {
  const vigentes = (pagos || []).filter((p) => p.estado !== 'anulado')
  const { pendiente, bonificada, valorTotal } = montoInfo(reserva)
  const saldo = saldoNumerico(reserva, vigentes)
  const abonado = tienePagoSinVerificar(vigentes)
    ? null
    : vigentes.reduce((acc, p) => acc + Number(p.monto || 0), 0)
  const pagoUnico = tipo === 'recibo' ? vigentes.find((p) => p.id === pagoId) || null : null

  return {
    numero: numeroComprobante(reserva),
    fechaEmision: new Date(),
    emitidoPor: perfil?.nombre || null,
    reservaId: reserva?.id || null,
    cliente: {
      nombre: reserva?.clientes?.nombre || null,
      cuit: reserva?.clientes?.cuit || null,
      dni: reserva?.clientes?.dni || null,
      telefono: reserva?.clientes?.telefono || null,
    },
    unidad: {
      tipo: reserva?.unidades?.tipo || null,
      numero: reserva?.unidades?.numero ?? null,
    },
    temporada: reserva?.temporada || null,
    tipoAlquiler: reserva?.tipo_alquiler || null,
    fechaInicio: reserva?.fecha_inicio || null,
    fechaFin: reserva?.fecha_fin || null,
    fecha: reserva?.fecha || null,
    pendienteConfirmacion: esPendienteConfirmacion(reserva),
    bonificada,
    montoTotalSinVerificar: pendiente,
    montoTotal: pendiente ? null : Number(valorTotal || 0),
    montoAbonado: abonado,
    saldo,
    pagos: vigentes.map(mapPago),
    pagoUnico: pagoUnico ? mapPago(pagoUnico) : null,
  }
}

/**
 * Validación previa a emitir/imprimir (PASO 3) — devuelve `null` si está
 * todo bien, o un mensaje concreto para el toast si falta algo. Una sola
 * fuente de verdad: la pantalla nunca decide "a mano" si puede imprimir.
 */
export function validarComprobante(datos, tipo = 'estado_cuenta') {
  if (!datos) return 'Seleccioná una reserva para emitir el comprobante.'
  if (!datos.cliente.nombre) return 'El cliente no tiene nombre cargado.'
  if (!datos.cliente.dni && !datos.cliente.cuit) return 'El cliente no tiene DNI ni CUIT cargado.'
  if (!datos.unidad.tipo || datos.unidad.numero == null) return 'La reserva no tiene unidad asignada.'
  if (datos.pendienteConfirmacion) return 'La reserva todavía no confirmó precio para esta temporada.'
  if (datos.montoTotalSinVerificar) return 'El monto total de esta reserva no está verificado todavía.'
  if (!datos.bonificada && Number(datos.montoTotal) <= 0) return 'El monto total de la reserva es $0.'
  if (datos.montoAbonado === null) return 'Hay pagos sin verificar: completá el monto antes de emitir.'
  if (datos.saldo === null) return 'El saldo de esta reserva no se puede calcular todavía.'
  if (datos.saldo < 0) return 'El saldo calculado es negativo — revisá los pagos de esta reserva.'

  if (tipo === 'recibo') {
    if (!datos.pagoUnico) return 'Seleccioná un pago para emitir el recibo.'
    if (datos.pagoUnico.sinVerificar) return 'Este pago no tiene un monto verificado todavía.'
  }
  return null
}

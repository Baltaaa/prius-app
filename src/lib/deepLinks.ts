/**
 * Único lugar donde se arman URLs de navegación interna del CRM (Tarea 1,
 * oct 2026). Prohibido construir strings de ruta a mano en componentes —
 * así un cambio de convención de query params (ej. renombrar `?id=` a
 * `?cliente=`) se hace en un solo archivo.
 *
 * Convención de destino: `useDeepLinkTarget` (`src/hooks/useDeepLinkTarget.js`)
 * consume estos params al montar la pantalla, abre el acordeón/modal
 * correspondiente, hace scrollIntoView suave y resalta el elemento con
 * `data-deeplink-id="<id>"` — cada pantalla que sea destino de un link debe
 * poner ese atributo en la fila/tarjeta correspondiente.
 */

export function linkToCliente(
  clienteId: string,
  opts?: { pagoId?: string; reservaId?: string; accion?: 'pagar' | 'cargar_monto' | 'cargar_recibos' | 'asignar_precio' },
): string {
  const params = new URLSearchParams({ id: clienteId })
  if (opts?.pagoId) params.set('pago', opts.pagoId)
  if (opts?.reservaId) params.set('reserva', opts.reservaId)
  // [feat-2] accion=pagar: además de resaltar, abre directo RegistrarPago
  // para ese cliente — usado desde la notificación de saldo pendiente.
  // accion=cargar_monto (oct 2026): abre DetallePago con el campo de monto
  // ya en edición — usado desde la notificación pago_sin_monto (un pago
  // puntual, ej. click directo en una celda de ReservaPagosCard).
  // accion=cargar_recibos (oct 2026): recorre en secuencia TODOS los
  // recibos sin monto de `reservaId` ("Recibo 1 de N" → ... ), vía el mismo
  // form de RegistrarPago en modo edición — usado desde la notificación
  // "Recibos sin monto asignado (N)" (una sola por reserva, nunca por recibo).
  // accion=asignar_precio (oct 2026): abre "Definir precio" directo para
  // `reservaId` — usado desde la notificación "Asignar monto total de
  // unidad" (reserva real sin precio cargado y sin pagos).
  if (opts?.accion) params.set('accion', opts.accion)
  return `/app/clientes?${params.toString()}`
}

export function linkToReserva(reservaId: string): string {
  return `/app/reservas?id=${reservaId}`
}

// [feat-2] "Nueva reserva" con el cliente ya precargado — usado desde la
// fila de un cliente en Clientes.jsx.
export function linkToNuevaReservaCliente(clienteId: string): string {
  return `/app/reservas?cliente=${clienteId}`
}

export function linkToPlano(fecha?: string | null, unidadId?: string | null): string {
  const params = new URLSearchParams()
  if (fecha) params.set('fecha', fecha)
  if (unidadId) params.set('unidad', unidadId)
  const qs = params.toString()
  return qs ? `/app/plano?${qs}` : '/app/plano'
}

export function linkToOcupacion(vista?: 'semana' | 'mes', fecha?: string | null): string {
  const params = new URLSearchParams()
  if (vista) params.set('vista', vista)
  if (fecha) params.set('fecha', fecha)
  const qs = params.toString()
  return qs ? `/app/ocupacion?${qs}` : '/app/ocupacion'
}

export function linkToComprobante(reservaId: string): string {
  return `/app/comprobantes?reserva=${reservaId}`
}

// Fase 3 (Recepción): con código, sobrevive a un refresh y se puede
// compartir/escanear directo a una reserva puntual. `scan`: abre directo en
// modo escaneo (ícono QR del TopBar, D1) en vez del estado inicial normal.
export function linkToRecepcion(codigo?: string | null, opts?: { scan?: boolean }): string {
  const params = new URLSearchParams()
  if (codigo) params.set('codigo', codigo)
  if (opts?.scan) params.set('scan', '1')
  const qs = params.toString()
  return qs ? `/app/recepcion?${qs}` : '/app/recepcion'
}

// Bandeja de notificaciones (oct 2026): destino del tipo `lead_nuevo`.
export function linkToLead(leadId: string): string {
  return `/app/leads?id=${leadId}`
}

export function linkToHistorial(filtros?: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros || {})) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `/app/historial?${qs}` : '/app/historial'
}

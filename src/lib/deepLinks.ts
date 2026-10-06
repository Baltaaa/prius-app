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

export function linkToCliente(clienteId: string, opts?: { pagoId?: string; reservaId?: string }): string {
  const params = new URLSearchParams({ id: clienteId })
  if (opts?.pagoId) params.set('pago', opts.pagoId)
  if (opts?.reservaId) params.set('reserva', opts.reservaId)
  return `/app/clientes?${params.toString()}`
}

export function linkToReserva(reservaId: string): string {
  return `/app/reservas?id=${reservaId}`
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

export function linkToHistorial(filtros?: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros || {})) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `/app/historial?${qs}` : '/app/historial'
}

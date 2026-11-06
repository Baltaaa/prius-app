import { linkToCliente, linkToReserva, linkToLead, linkToPlano, linkToCaja } from './deepLinks'
import { diaDeEvento } from './historialDias'

// Único resolver de "a dónde lleva un evento del Historial". Reemplaza la
// cadena de `if (evento.tabla === ...)` que vivía en Historial.jsx y que mandaba
// a Reservas eventos de reservas de temporada (donde no aparecen: son del
// directorio de Clientes) o a pantallas vacías cuando el registro ya no existía.
//
// Reglas:
// - Cliente, o reserva de TEMPORADA -> /app/clientes con la ficha abierta y resaltada.
// - Reserva de DÍA o PERÍODO -> /app/reservas con esa reserva abierta (ahí sí se ve).
// - Pagos, comprobantes y cosocios -> ficha de su cliente.
// - Lead, unidad, caja -> su pantalla.
// - Eventos de sesión (auth) y migración histórica: sin destino.
// - Si la entidad ya no existe -> { inexistente: true } (el llamador avisa con toast).
//
// Devuelve: { ruta } | { inexistente: true } | null (el evento no tiene destino).

export const MENSAJE_REGISTRO_INEXISTENTE = 'Este registro ya no existe'

// Reservas.jsx lista solo estos tipos (cola operativa); temporada vive en Clientes.
const TIPOS_EN_RESERVAS = ['periodo', 'dia']

const datosDe = (evento) => ({ after: evento?.datos?.after || {}, before: evento?.datos?.before || {} })
const val = (evento, campo) => {
  const { after, before } = datosDe(evento)
  return after[campo] ?? before[campo] ?? null
}

/** Cliente al que pertenece el evento, si el evento lo trae. */
export function clienteIdDeEvento(evento) {
  return evento?.cliente_id || val(evento, 'cliente_id') || null
}

export function resolverDestinoEvento(evento, { reservas = [], clientes = [], pagos = [], leads = [], unidades = [] } = {}) {
  if (!evento) return null
  const existeCliente = (id) => !!id && clientes.some((c) => c.id === id)
  const aCliente = (id, opts) => (existeCliente(id) ? { ruta: linkToCliente(id, opts) } : { inexistente: true })

  switch (evento.tabla) {
    case 'clientes':
      return aCliente(evento.registro_id || clienteIdDeEvento(evento))

    case 'reservas': {
      const reserva = reservas.find((r) => r.id === evento.registro_id)
      if (!reserva) return { inexistente: true }
      if (TIPOS_EN_RESERVAS.includes(reserva.tipo_alquiler)) return { ruta: linkToReserva(reserva.id) }
      // Temporada (o un tipo que Reservas no lista): la ficha del cliente titular.
      return aCliente(reserva.cliente_id, { reservaId: reserva.id })
    }

    case 'pagos': {
      const pago = pagos.find((p) => p.id === evento.registro_id)
      const clienteId = pago?.cliente_id || clienteIdDeEvento(evento)
      // Pago borrado pero cliente vivo: la ficha igual sirve; sin pago no hay celda que resaltar.
      return aCliente(clienteId, pago ? { pagoId: pago.id, reservaId: pago.reserva_id || undefined } : undefined)
    }

    case 'comprobantes': {
      const pago = pagos.find((p) => p.id === val(evento, 'pago_id'))
      const reserva = reservas.find((r) => r.id === val(evento, 'reserva_id'))
      return aCliente(clienteIdDeEvento(evento) || pago?.cliente_id || reserva?.cliente_id)
    }

    case 'reserva_clientes': {
      // Cosocio agregado/quitado: la ficha del cosocio (el evento no trae registro_id).
      const reserva = reservas.find((r) => r.id === val(evento, 'reserva_id'))
      return aCliente(clienteIdDeEvento(evento) || reserva?.cliente_id, reserva ? { reservaId: reserva.id } : undefined)
    }

    case 'leads':
      return leads.some((l) => l.id === evento.registro_id) ? { ruta: linkToLead(evento.registro_id) } : { inexistente: true }

    case 'unidades':
      return unidades.some((u) => u.id === evento.registro_id)
        ? { ruta: linkToPlano(null, evento.registro_id) }
        : { inexistente: true }

    case 'caja_diaria':
      return { ruta: linkToCaja(val(evento, 'fecha') || diaDeEvento(evento)) }

    case 'gastos_caja':
      return { ruta: linkToCaja(diaDeEvento(evento)) }

    default:
      // auth, ingresos_caja (migración histórica) y lo que se agregue sin destino definido.
      return null
  }
}

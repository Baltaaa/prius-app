import { describe, it, expect } from 'vitest'
import { resolverDestinoEvento } from './destinoEvento'

const ctx = {
  clientes: [{ id: 'c1' }, { id: 'c2' }],
  reservas: [
    { id: 'rt', tipo_alquiler: 'temporada', cliente_id: 'c1' },
    { id: 'rp', tipo_alquiler: 'periodo', cliente_id: 'c1' },
    { id: 'rd', tipo_alquiler: 'dia', cliente_id: 'c2' },
  ],
  pagos: [{ id: 'p1', cliente_id: 'c1', reserva_id: 'rt' }],
  leads: [{ id: 'l1' }],
  unidades: [{ id: 'u1' }],
}
const ev = (tabla: string, extra: Record<string, unknown> = {}) => ({ tabla, ts: '2026-11-05T15:00:00Z', ...extra })

describe('resolverDestinoEvento', () => {
  it('cliente (alta/editado/eliminado): ficha si existe, "ya no existe" si no', () => {
    expect(resolverDestinoEvento(ev('clientes', { registro_id: 'c1', tipo_evento: 'cliente_alta' }), ctx)).toEqual({ ruta: '/app/clientes?id=c1' })
    expect(resolverDestinoEvento(ev('clientes', { registro_id: 'borrado', tipo_evento: 'cliente_eliminado' }), ctx)).toEqual({ inexistente: true })
  })

  it('reserva de temporada: ficha del cliente, nunca Reservas (todos los tipos de evento de reservas)', () => {
    for (const tipo_evento of ['reserva_alta', 'reserva_editada', 'reserva_cancelada', 'cambio_unidad', 'nota', 'estado_pago_manual', 'estado_pago_manual_revertido']) {
      const d = resolverDestinoEvento(ev('reservas', { registro_id: 'rt', tipo_evento }), ctx)
      expect(d, tipo_evento).toEqual({ ruta: '/app/clientes?id=c1&reserva=rt' })
    }
  })

  it('reserva de día o período: Reservas con esa reserva abierta', () => {
    expect(resolverDestinoEvento(ev('reservas', { registro_id: 'rp' }), ctx)).toEqual({ ruta: '/app/reservas?id=rp' })
    expect(resolverDestinoEvento(ev('reservas', { registro_id: 'rd' }), ctx)).toEqual({ ruta: '/app/reservas?id=rd' })
  })

  it('reserva eliminada: no existe', () => {
    expect(resolverDestinoEvento(ev('reservas', { registro_id: 'x', tipo_evento: 'reserva_eliminada' }), ctx)).toEqual({ inexistente: true })
  })

  it('pago (pago, pago_editado, anulacion, pago_eliminado): ficha del cliente con el pago resaltado', () => {
    for (const tipo_evento of ['pago', 'pago_editado', 'anulacion']) {
      expect(resolverDestinoEvento(ev('pagos', { registro_id: 'p1', tipo_evento }), ctx), tipo_evento)
        .toEqual({ ruta: '/app/clientes?id=c1&pago=p1&reserva=rt' })
    }
    expect(resolverDestinoEvento(ev('pagos', { registro_id: 'x', cliente_id: 'c2', tipo_evento: 'pago_eliminado' }), ctx)).toEqual({ ruta: '/app/clientes?id=c2' })
    expect(resolverDestinoEvento(ev('pagos', { registro_id: 'x', cliente_id: 'zz', tipo_evento: 'pago_eliminado' }), ctx)).toEqual({ inexistente: true })
  })

  it('comprobante: ficha del cliente (por cliente_id del dato, por el pago o por la reserva)', () => {
    expect(resolverDestinoEvento(ev('comprobantes', { registro_id: 'k', datos: { after: { cliente_id: 'c2' } } }), ctx)).toEqual({ ruta: '/app/clientes?id=c2' })
    expect(resolverDestinoEvento(ev('comprobantes', { registro_id: 'k', datos: { after: { pago_id: 'p1' } } }), ctx)).toEqual({ ruta: '/app/clientes?id=c1' })
    expect(resolverDestinoEvento(ev('comprobantes', { registro_id: 'k', tipo_evento: 'comprobante_eliminado', datos: { before: { cliente_id: 'zz' } } }), ctx)).toEqual({ inexistente: true })
    expect(resolverDestinoEvento(ev('comprobantes', { registro_id: 'k' }), ctx)).toEqual({ inexistente: true })
  })

  it('cosocios (agregado/quitado): ficha del cosocio', () => {
    expect(resolverDestinoEvento(ev('reserva_clientes', { cliente_id: 'c2', datos: { before: { cliente_id: 'c2', reserva_id: 'rt' } } }), ctx)).toEqual({ ruta: '/app/clientes?id=c2&reserva=rt' })
  })

  it('lead, unidad y caja van a su pantalla; lo borrado avisa', () => {
    expect(resolverDestinoEvento(ev('leads', { registro_id: 'l1' }), ctx)).toEqual({ ruta: '/app/leads?id=l1' })
    expect(resolverDestinoEvento(ev('leads', { registro_id: 'l9' }), ctx)).toEqual({ inexistente: true })
    expect(resolverDestinoEvento(ev('unidades', { registro_id: 'u1' }), ctx)).toEqual({ ruta: '/app/plano?unidad=u1' })
    expect(resolverDestinoEvento(ev('caja_diaria', { registro_id: 'cj', datos: { after: { fecha: '2026-11-05' } } }), ctx)).toEqual({ ruta: '/app/caja?fecha=2026-11-05' })
    expect(resolverDestinoEvento(ev('gastos_caja', { registro_id: 'g1' }), ctx)).toEqual({ ruta: '/app/caja?fecha=2026-11-05' })
  })

  it('auth y migración histórica no tienen destino', () => {
    expect(resolverDestinoEvento(ev('auth', { tipo_evento: 'login' }), ctx)).toBeNull()
    expect(resolverDestinoEvento(ev('ingresos_caja', { tipo_evento: 'migracion_historica' }), ctx)).toBeNull()
  })
})

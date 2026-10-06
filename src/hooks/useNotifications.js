import { useMemo } from 'react'
import { useData } from '../context/DataProvider'
import { useNotificacionesLeidas } from './useNotificacionesLeidas'
import { formatPesos } from '../lib/format'

const todayStr = () => new Date().toISOString().split('T')[0]
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

// Fecha de llegada real de una reserva — mismo problema que Reservas.jsx
// (Tarea 4): temporada no tiene fecha propia, se resuelve contra
// `temporadas` vía temporada_id. Bug encontrado en esta auditoría (Tarea
// 8): antes se usaba `r.fecha_inicio === hoy` a secas, que solo existe en
// reservas de período — las de temporada (139 de 145) nunca disparaban
// "llegada hoy/mañana" por esa razón.
function fechaLlegada(r, temporadasPorId) {
  if (r.tipo_alquiler === 'dia') return r.fecha || null
  if (r.tipo_alquiler === 'periodo') return r.fecha_inicio || null
  if (r.tipo_alquiler === 'temporada') return temporadasPorId[r.temporada_id]?.fecha_inicio || null
  return null
}

// Fuente única de alertas del CRM. Usado por el badge del Sidebar/BottomNav,
// el dropdown de la campanita (TopBar) y el centro de notificaciones
// completo (Notificaciones.jsx). Estado de lectura persistido por usuario
// (useNotificacionesLeidas, no hay un segundo sistema de escritura para las
// notificaciones en sí, que siguen siendo computadas).
//
// Ya no dispara fetches propios: lee del DataProvider y memoiza el cálculo,
// así montarlo en TopBar + Sidebar no cuesta nada.
export function useNotifications() {
  const { reservas, cajaHoy, eventos, temporadas, loading } = useData()
  const { leidas, marcarLeida, marcarTodas } = useNotificacionesLeidas()
  const hoy = useMemo(() => todayStr(), [])
  const mañana = useMemo(() => addDays(hoy, 1), [hoy])

  const temporadasPorId = useMemo(() => {
    const map = {}
    for (const t of temporadas) map[t.id] = t
    return map
  }, [temporadas])

  return useMemo(() => {
    const activas = reservas.filter((r) => r.estado !== 'cancelada')
    // pendiente_confirmacion se separa de "saldo pendiente": conceptualmente
    // es otra cosa (cliente de la temporada pasada sin confirmar, no una
    // deuda sobre una reserva ya aceptada) y evita duplicar la misma
    // reserva en dos notificaciones.
    const saldosPendientes = activas.filter((r) => Number(r.saldo) > 0 && r.estado_pago !== 'pendiente_confirmacion')
    const pendientesConfirmacion = activas.filter((r) => r.estado_pago === 'pendiente_confirmacion')
    const checkinsHoy = activas.filter((r) => fechaLlegada(r, temporadasPorId) === hoy)
    const checkinsMañana = activas.filter((r) => fechaLlegada(r, temporadasPorId) === mañana)
    // Cancelaciones recientes (últimas 48hs) desde el log de auditoría —
    // tabla `eventos`, ver CLAUDE.md "Historial". No hace falta un segundo
    // camino de escritura: ya se loguean solas por trigger.
    const corte48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const cancelacionesRecientes = (eventos || []).filter(
      (e) => e.tipo_evento === 'reserva_cancelada' && e.ts >= corte48h,
    )
    const reservasRecientes = (eventos || []).filter(
      (e) => (e.tipo_evento === 'reserva_alta' || e.tipo_evento === 'reserva_editada') && e.ts >= corte48h,
    )
    const cajaSinIniciar = !cajaHoy

    const items = [
      ...(cajaSinIniciar
        ? [{ id: 'caja-pendiente', type: 'caja', urgente: true, titulo: 'Caja pendiente', detalle: 'Recordá iniciar la caja diaria de hoy.' }]
        : []),
      ...checkinsHoy.map((r) => ({
        id: `checkin-${r.id}`,
        reservaId: r.id,
        clienteId: r.cliente_id,
        unidadId: r.unidad_id,
        tipoAlquiler: r.tipo_alquiler,
        type: 'checkin',
        urgente: true,
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Ingreso hoy · ${r.unidades?.tipo || 'Unidad'} #${r.unidades?.numero ?? ''}`,
      })),
      ...checkinsMañana.map((r) => ({
        id: `checkin-mañana-${r.id}`,
        reservaId: r.id,
        clienteId: r.cliente_id,
        unidadId: r.unidad_id,
        tipoAlquiler: r.tipo_alquiler,
        type: 'checkin_mañana',
        urgente: false,
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Ingreso mañana · ${r.unidades?.tipo || 'Unidad'} #${r.unidades?.numero ?? ''}`,
      })),
      ...saldosPendientes.map((r) => {
        const llegada = fechaLlegada(r, temporadasPorId)
        return {
          id: `saldo-${r.id}`,
          reservaId: r.id,
          clienteId: r.cliente_id,
          type: 'saldo',
          // Urgente: ya llegó, o llega dentro de los próximos 7 días —
          // saldos con llegada lejana todavía tienen tiempo de cobrarse.
          urgente: !!llegada && llegada <= addDays(hoy, 7),
          titulo: r.clientes?.nombre || 'Cliente s/n',
          detalle: `Saldo pendiente: ${formatPesos(r.saldo)}`,
        }
      }),
      ...pendientesConfirmacion.map((r) => ({
        id: `pendconf-${r.id}`,
        reservaId: r.id,
        clienteId: r.cliente_id,
        type: 'pendiente_confirmacion',
        urgente: false,
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Sin confirmar temporada · ${r.unidades?.tipo || 'Unidad'} #${r.unidades?.numero ?? ''}`,
      })),
      ...cancelacionesRecientes.map((e) => ({
        id: `cancel-${e.id}`,
        reservaId: e.registro_id,
        clienteId: e.datos?.after?.cliente_id || e.datos?.before?.cliente_id,
        type: 'cancelacion',
        urgente: false,
        titulo: 'Reserva cancelada',
        detalle: e.descripcion,
        ts: e.ts,
      })),
      ...reservasRecientes.map((e) => ({
        id: `reserva-evt-${e.id}`,
        reservaId: e.registro_id,
        clienteId: e.datos?.after?.cliente_id || e.datos?.before?.cliente_id,
        type: e.tipo_evento === 'reserva_alta' ? 'reserva_nueva' : 'reserva_modificada',
        urgente: false,
        titulo: e.tipo_evento === 'reserva_alta' ? 'Reserva nueva' : 'Reserva modificada',
        detalle: e.descripcion,
        ts: e.ts,
      })),
    ].map((item) => ({ ...item, leida: leidas.has(item.id) }))

    const noLeidas = items.filter((i) => !i.leida)

    return {
      items,
      count: noLeidas.length,
      urgentes: items.filter((i) => i.urgente),
      informativas: items.filter((i) => !i.urgente),
      loading,
      saldosPendientes,
      checkinsHoy,
      checkinsMañana,
      pendientesConfirmacion,
      cajaSinIniciar,
      marcarLeida,
      marcarTodas: () => marcarTodas(items.map((i) => i.id)),
    }
  }, [reservas, cajaHoy, eventos, temporadasPorId, loading, hoy, mañana, leidas, marcarLeida, marcarTodas])
}

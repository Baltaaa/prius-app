import { useMemo } from 'react'
import { useData } from '../context/DataProvider'
import { useNotificacionesLeidas } from './useNotificacionesLeidas'
import { formatPesos } from '../lib/format'

// Fuente única de alertas del CRM: caja sin iniciar, check-ins de hoy y saldos
// pendientes. Usado por el badge del Sidebar/BottomNav, el dropdown de la
// campanita (TopBar) y el centro de notificaciones completo
// (Notificaciones.jsx) — ítem 3, oct 2026: ahora con prioridad (urgente/
// informativa) y estado de lectura persistido por usuario
// (useNotificacionesLeidas, no hay un segundo sistema de escritura para las
// notificaciones en sí, que siguen siendo computadas).
//
// Ya no dispara fetches propios de reservas/caja: lee del DataProvider y
// memoiza el cálculo, así montarlo en TopBar + Sidebar no cuesta nada.
export function useNotifications() {
  const { reservas, cajaHoy, loading } = useData()
  const { leidas, marcarLeida, marcarTodas } = useNotificacionesLeidas()
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  return useMemo(() => {
    const saldosPendientes = reservas.filter((r) => Number(r.saldo) > 0)
    const checkinsHoy = reservas.filter((r) => r.fecha_inicio === todayStr)
    const cajaSinIniciar = !cajaHoy

    // Urgente: saldo pendiente con check-in hoy o ya pasado (el resto de
    // saldos pendientes, con check-in a futuro, es informativo — todavía
    // hay tiempo de cobrar). Caja sin iniciar y check-in de hoy son siempre
    // urgentes: son del día.
    const items = [
      ...(cajaSinIniciar
        ? [{ id: 'caja-pendiente', type: 'caja', urgente: true, titulo: 'Caja pendiente', detalle: 'Recordá iniciar la caja diaria de hoy.' }]
        : []),
      ...checkinsHoy.map((r) => ({
        id: `checkin-${r.id}`,
        reservaId: r.id,
        type: 'checkin',
        urgente: true,
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Ingreso hoy · ${r.unidades?.tipo || 'Unidad'} #${r.unidades?.numero ?? ''}`,
      })),
      ...saldosPendientes.map((r) => ({
        id: `saldo-${r.id}`,
        reservaId: r.id,
        type: 'saldo',
        urgente: !!r.fecha_inicio && r.fecha_inicio <= todayStr,
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Saldo pendiente: ${formatPesos(r.saldo)}`,
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
      cajaSinIniciar,
      marcarLeida,
      marcarTodas: () => marcarTodas(items.map((i) => i.id)),
    }
  }, [reservas, cajaHoy, loading, todayStr, leidas, marcarLeida, marcarTodas])
}

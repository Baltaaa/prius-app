import { useMemo } from 'react'
import { useData } from '../context/DataProvider'

// Fuente única de alertas del CRM: caja sin iniciar, check-ins de hoy y saldos
// pendientes. Usado por el badge del Sidebar, el dropdown de la campanita
// (TopBar) y el centro de notificaciones completo (Notificaciones.jsx).
//
// Ya no dispara fetches propios: lee del DataProvider y memoiza el cálculo,
// así montarlo en TopBar + Sidebar no cuesta nada.
export function useNotifications() {
  const { reservas, cajaHoy, loading } = useData()
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  return useMemo(() => {
    const saldosPendientes = reservas.filter((r) => Number(r.saldo) > 0)
    const checkinsHoy = reservas.filter((r) => r.fecha_inicio === todayStr)
    const cajaSinIniciar = !cajaHoy

    const items = [
      ...(cajaSinIniciar
        ? [{ id: 'caja-pendiente', type: 'caja', titulo: 'Caja pendiente', detalle: 'Recordá iniciar la caja diaria de hoy.' }]
        : []),
      ...checkinsHoy.map((r) => ({
        id: `checkin-${r.id}`,
        type: 'checkin',
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Ingreso hoy · ${r.unidades?.tipo || 'Unidad'} #${r.unidades?.numero ?? ''}`,
      })),
      ...saldosPendientes.map((r) => ({
        id: `saldo-${r.id}`,
        type: 'saldo',
        titulo: r.clientes?.nombre || 'Cliente s/n',
        detalle: `Saldo pendiente: $${r.saldo}`,
      })),
    ]

    return { items, count: items.length, loading, saldosPendientes, checkinsHoy, cajaSinIniciar }
  }, [reservas, cajaHoy, loading, todayStr])
}

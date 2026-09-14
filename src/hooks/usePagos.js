import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Motor de pagos (Fase 2): un solo hook,
// reutilizado desde Clientes y Reservas, para no duplicar el alta de pago
// ni el cálculo de saldo (eso lo hace el trigger fn_pago_actualiza_saldo).
export function usePagos(reservaId) {
  const { pagos, createPago, loading, error } = useData()
  const pagosDeReserva = reservaId ? pagos.filter((p) => p.reserva_id === reservaId) : pagos
  return { pagos: pagosDeReserva, createPago, loading, error }
}

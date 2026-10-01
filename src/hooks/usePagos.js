import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Motor de pagos (Fase 3, RPC-only): un solo
// hook, reutilizado desde Clientes, Reservas y el Plano, para no duplicar el
// alta/anulación de pago ni el cálculo de saldo (eso lo hace la RPC
// registrar_pago + el trigger fn_pago_actualiza_saldo).
export function usePagos(reservaId) {
  const { pagos, registrarPago, anularPago, completarComprobante, loading, error } = useData()
  const pagosDeReserva = reservaId ? pagos.filter((p) => p.reserva_id === reservaId) : pagos
  return { pagos: pagosDeReserva, registrarPago, anularPago, completarComprobante, loading, error }
}

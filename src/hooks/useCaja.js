import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Misma API que antes + historial/ingresos
// itemizados para la navegación por fecha de Caja Diaria. Fase 3 (dinero):
// las escrituras pasan por RPC (abrir_caja/registrar_gasto/anular_gasto/
// cerrar_caja/reabrir_caja), no por insert/update directo.
export function useCaja() {
  const {
    cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja, loading, error,
    iniciarCaja, registrarGasto, anularGasto, cerrarCaja, reabrirCaja, fetchCaja,
  } = useData()
  return {
    cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja, loading, error,
    iniciarCaja, registrarGasto, anularGasto, cerrarCaja, reabrirCaja, refetch: fetchCaja,
  }
}

import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Misma API que antes + historial/ingresos
// itemizados para la navegación por fecha de Caja Diaria (Fase 2).
export function useCaja() {
  const {
    cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja, loading, error,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja, fetchCaja,
  } = useData()
  return {
    cajaHoy, historialCajas, gastos, todosGastos, ingresosCaja, loading, error,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja, refetch: fetchCaja,
  }
}

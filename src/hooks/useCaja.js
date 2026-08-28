import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Misma API que antes.
export function useCaja() {
  const {
    cajaHoy, historialCajas, gastos, loading, error,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja, fetchCaja,
  } = useData()
  return {
    cajaHoy, historialCajas, gastos, loading, error,
    iniciarCaja, actualizarCajaValores, agregarGasto, eliminarGasto, cerrarCaja, refetch: fetchCaja,
  }
}

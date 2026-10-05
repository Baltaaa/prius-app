import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Mantiene la misma API que antes para no
// tocar las páginas que lo consumen.
export function useReservas() {
  const {
    reservas, unidades, temporadaActiva, loading, error,
    createReserva, updateReserva, deleteReserva, cancelarReserva, crearGrupoReservas, refetchAll,
  } = useData()
  return {
    reservas, unidades, temporadaActiva, loading, error,
    createReserva, updateReserva, deleteReserva, cancelarReserva, crearGrupoReservas, refetch: refetchAll,
  }
}

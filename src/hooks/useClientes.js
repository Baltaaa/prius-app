import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider. Misma API que antes.
export function useClientes() {
  const {
    clientes, loading, error,
    createCliente, updateCliente, deleteCliente, refetchAll,
  } = useData()
  return {
    clientes, loading, error,
    createCliente, updateCliente, deleteCliente, refetch: refetchAll,
  }
}

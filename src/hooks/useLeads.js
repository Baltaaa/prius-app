import { useMemo } from 'react'
import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider para la bandeja de Leads.
// `leads` llega ordenado por created_at desc y se refresca solo vía Realtime.
export function useLeads() {
  const { leads, loading, error, updateLead, deleteLead, refetchAll } = useData()

  const sinContactar = useMemo(
    () => leads.filter((l) => (l.estado || 'nuevo') === 'nuevo').length,
    [leads]
  )

  return {
    leads,
    loading,
    error,
    sinContactar,
    updateLead,
    deleteLead,
    refetch: refetchAll,
  }
}

// `waLink` vive ahora en src/lib/telefono.ts (libphonenumber-js, un solo
// normalizador para toda la app). Se re-exporta desde acá nada más para no
// romper imports viejos; los call sites nuevos deberían importarlo de ahí.
export { waLink } from '../lib/telefono'

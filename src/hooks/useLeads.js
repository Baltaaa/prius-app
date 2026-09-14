import { useMemo } from 'react'
import { useData } from '../context/DataProvider'

// Selector sobre el DataProvider para la bandeja de Leads.
// `leads` llega ordenado por created_at desc y se refresca solo vía Realtime.
export function useLeads() {
  const { leads, loading, error, updateLead, refetchAll } = useData()

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
    refetch: refetchAll,
  }
}

// Normaliza un teléfono argentino a link wa.me (formato internacional 549...).
// Heurística pragmática: descarta prefijos 0 / 54 / 9 y el 15 de celular local.
// Devuelve null si no hay dígitos suficientes.
export function waLink(telefono) {
  let d = String(telefono || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9')) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
  if (d.length < 8) return null
  return `https://wa.me/549${d}`
}

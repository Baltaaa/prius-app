import { useEffect, useState } from 'react'

// Retrasa la propagación de un valor que cambia rápido (ej: input de búsqueda),
// para no recalcular filtros sobre listas grandes en cada pulsación.
export function useDebounced(value, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

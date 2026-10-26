import { createContext, useCallback, useContext, useState } from 'react'
import ReservaFormModal from '../components/crm/ReservaFormModal'

const NuevaReservaContext = createContext(null)

// Ítem 8 (25/10/2026): "Nueva reserva" pasa a ser un solo botón global — el
// modal (ReservaFormModal) se monta UNA vez acá, en AppLayout, para que
// cualquier pantalla pueda abrirlo en el lugar donde está parado el
// usuario (Sidebar, "+" de la bottom nav, "Nueva reserva" contextual de
// Clientes/Plano), sin navegar a /app/reservas primero. Reservas.jsx sigue
// siendo dueño de SU flujo de edición (deep-link ?id=, click de fila) vía
// `abrirEdicionReserva`, mismo modal, sin duplicar el form.
export function NuevaReservaProvider({ children }) {
  const [estado, setEstado] = useState({ isOpen: false, editingReserva: null, prefill: null })

  const abrirNuevaReserva = useCallback((prefill = null) => {
    setEstado({ isOpen: true, editingReserva: null, prefill })
  }, [])

  const abrirEdicionReserva = useCallback((reserva) => {
    setEstado({ isOpen: true, editingReserva: reserva, prefill: null })
  }, [])

  const cerrarModalReserva = useCallback(() => {
    setEstado((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return (
    <NuevaReservaContext.Provider value={{ abrirNuevaReserva, abrirEdicionReserva }}>
      {children}
      <ReservaFormModal
        isOpen={estado.isOpen}
        onClose={cerrarModalReserva}
        editingReserva={estado.editingReserva}
        prefill={estado.prefill}
      />
    </NuevaReservaContext.Provider>
  )
}

export function useNuevaReserva() {
  const ctx = useContext(NuevaReservaContext)
  if (!ctx) throw new Error('useNuevaReserva debe usarse dentro de <NuevaReservaProvider>')
  return ctx
}

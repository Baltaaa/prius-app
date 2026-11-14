import { createContext, useContext, useEffect } from 'react'

// Título de la barra única (PageTopbar). Por default es el de la sección
// (lib/sectionTitles.js); una pantalla con subpantallas propias —hoy solo
// Configuración en mobile— lo pisa mientras una está abierta, para que el
// título y el botón "atrás" de la barra correspondan a lo que se está viendo.
export const TituloPaginaContext = createContext(null)

/** `titulo` null/undefined -> queda el título de la sección. */
export function useTituloPagina(titulo) {
  const ctx = useContext(TituloPaginaContext)
  const set = ctx?.setTitulo
  useEffect(() => {
    if (!set) return undefined
    set(titulo || null)
    return () => set(null)
  }, [set, titulo])
}

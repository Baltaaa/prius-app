import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { ToolbarSlotContext } from './toolbarSlot'

// Slot de la zona sticky superior (ver ProgressiveBlurHeader y AppLayout.jsx).
// La toolbar de cada sección (filtros de Historial, tabs de Leads, controles
// de Reportes, buscador de Clientes…) se envuelve en <ToolbarSticky> y se
// monta DENTRO de la zona flotante, debajo de la topbar: una sola pieza que
// el contenido atraviesa al scrollear. Los handlers y refs de la toolbar
// siguen siendo los de la página (es un portal: el árbol de React no cambia).
//
// Fuera del AppLayout (tests, vistas sueltas) no hay slot: se renderiza en el
// lugar, como cualquier div.
export default function ToolbarSticky({ children }) {
  const slot = useContext(ToolbarSlotContext)
  if (slot === undefined) return children
  return slot ? createPortal(children, slot) : null
}

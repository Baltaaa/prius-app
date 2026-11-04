import { createContext } from 'react'

// Slot de la zona sticky superior: AppLayout publica acá el nodo donde las
// páginas montan su toolbar (ver ToolbarSticky.jsx). `undefined` = no hay
// layout (tests, vistas sueltas); `null` = hay layout pero el nodo todavía no
// existe.
export const ToolbarSlotContext = createContext(undefined)

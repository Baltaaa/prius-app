// Helpers compartidos del módulo Caja para pantalla/impresión (no CSV — el
// export CSV del cierre vive en `lib/export/cajaCsv.ts`, oct 2026, Tarea 3).
// CATEGORIA_GASTO_LABEL vive de verdad en `lib/export/formatos.ts` (fuente
// única de etiquetas legibles); se reexporta acá para no romper los
// imports existentes de RegistrarGasto/CajaImpresion/DetalleGasto/
// ResumenCaja/Caja.jsx.
export { CATEGORIA_GASTO_LABEL, CATEGORIA_GASTO_EMOJI } from './export/formatos'
export { formatHora } from './format'

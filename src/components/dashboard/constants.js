// Estado visual de una celda del plano. Deriva del tipo_alquiler de la reserva
// vigente HOY sobre esa unidad (o LIBRE si no hay ninguna vigente).
export const STATUS = {
  LIBRE: "libre",
  TEMPORADA: "temporada",
  PENDIENTE_CONFIRMACION: "pendiente_confirmacion",
  PERIODO: "periodo",
  DIA: "dia"
}

// La geometría del plano (columnas, pasillos, gap espalda-con-espalda,
// agrupación de carpas, lado del número) vive en una sola constante
// compartida: src/components/plano/planoLayout.js — pantalla (PlanoGrid.jsx)
// e impresión (PlanoImpresion.jsx) la importan de ahí, nunca duplicada acá
// (oct 2026: se sacaron los PLANO_* que vivían en este archivo, quedaban
// huérfanos y desincronizados del layout real).

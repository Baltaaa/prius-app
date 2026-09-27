// Estado visual de una celda del plano. Deriva del tipo_alquiler de la reserva
// vigente HOY sobre esa unidad (o LIBRE si no hay ninguna vigente).
export const STATUS = {
  LIBRE: "libre",
  TEMPORADA: "temporada",
  PENDIENTE_CONFIRMACION: "pendiente_confirmacion",
  PERIODO: "periodo",
  DIA: "dia"
}

// Layout geométrico del sector de carpas (definido con el dueño, sept 2026;
// ver CLAUDE.md sección Diseño). Único lugar con estos anchos — tanto la
// pantalla (px, como gap) como la impresión (mismos valores usados como
// fr, ver PlanoImpresion.jsx) leen de acá, nada de valores mágicos sueltos
// en el JSX.
export const PLANO_COL_WIDTH = 52       // columna (número + casilla), desktop
export const PLANO_PASILLO_LATERAL = 96  // pasillos A y C (~3.4 anchos de casilla)
export const PLANO_PASILLO_CENTRAL = 150 // pasillo B, central, alineado con Acceso
export const PLANO_BLOQUE_GAP = 2        // gap espalda-con-espalda en un bloque doble
export const PLANO_SECTOR_WIDTH =
  PLANO_COL_WIDTH * 3 + PLANO_PASILLO_LATERAL + PLANO_BLOQUE_GAP

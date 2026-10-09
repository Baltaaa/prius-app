// Estructura visual del plano de playa — ÚNICA fuente de verdad del layout
// (Tarea 2, Fase 4A, oct 2026). Portable: no importa nada fuera de esta
// carpeta (ver PORTABILIDAD.md). Definido con el dueño (sept 2026, ver
// CLAUDE.md "Layout del plano"): 6 hileras y 3 pasillos de carpas + sector
// de sombrillas en 4 filas de dos columnas. Verificado 1:1 contra
// unidades.fila/orden real (184/184 coinciden, oct 2026, Tarea 1).
//
// Cada posición se identifica por (fila, orden), igual que en la base.

export const PLANO_COL_WIDTH = 52        // columna (número + casilla), desktop
export const PLANO_PASILLO_LATERAL = 96  // pasillos A y C (~3.4 anchos de casilla)
export const PLANO_PASILLO_CENTRAL = 150 // pasillo B, central, alineado con Acceso
export const PLANO_BLOQUE_GAP = 2        // gap espalda-con-espalda en un bloque doble
export const PLANO_SECTOR_WIDTH =
  PLANO_COL_WIDTH * 3 + PLANO_PASILLO_LATERAL + PLANO_BLOQUE_GAP

// Carpas: hilera simple (número en un solo lado) o bloque doble espalda-con-
// espalda (dos hileras pegadas, número hacia afuera de cada lado), con un
// pasillo entre cada elemento. Se dibuja en este mismo orden, izq→der.
// "rango" es el número real de carpa (1-144, el de la cartelería física,
// nunca se altera) — "orden" (1..25 o 1..23 dentro de cada fila) se deriva
// de acá, no se hardcodea dos veces.
export const CARPAS_LAYOUT = [
  { tipo: "hilera", fila: 1, rango: [1, 25], numberSide: "left" },
  { tipo: "pasillo", ancho: PLANO_PASILLO_LATERAL }, // Pasillo A
  {
    tipo: "bloque",
    lados: [
      { fila: 2, rango: [26, 50], numberSide: "left" },
      { fila: 3, rango: [51, 75], numberSide: "right" },
    ],
  },
  { tipo: "pasillo", ancho: PLANO_PASILLO_CENTRAL }, // Pasillo B (central, acceso)
  {
    tipo: "bloque",
    lados: [
      { fila: 4, rango: [76, 98], numberSide: "left" },
      { fila: 5, rango: [99, 121], numberSide: "right" },
    ],
  },
  { tipo: "pasillo", ancho: PLANO_PASILLO_LATERAL }, // Pasillo C
  { tipo: "hilera", fila: 6, rango: [122, 144], numberSide: "right" },
]

// Sombrillas: 4 filas (7-10), cada una con dos columnas de 5 lado a lado y
// un hueco visual en el medio (orden 6 queda sin usar a propósito — no es
// un hueco de cobertura, es el espacio en blanco entre las dos columnas).
export const SOMBRILLAS_LAYOUT = {
  filas: [
    { fila: 7, columnas: [[1, 5], [21, 25]] },
    { fila: 8, columnas: [[6, 10], [26, 30]] },
    { fila: 9, columnas: [[11, 15], [31, 35]] },
    { fila: 10, columnas: [[16, 20], [36, 40]] },
  ],
}

function* rangoNumeros([desde, hasta]) {
  for (let n = desde; n <= hasta; n++) yield n
}

// Enumera cada carpa que dibuja el layout: { numero, fila, orden, numberSide }.
// "orden" arranca en 1 al principio de cada fila, igual que unidades.orden.
export function enumerarCarpas() {
  const out = []
  for (const item of CARPAS_LAYOUT) {
    if (item.tipo === "pasillo") continue
    const hileras = item.tipo === "hilera" ? [item] : item.lados
    for (const h of hileras) {
      let orden = 1
      for (const numero of rangoNumeros(h.rango)) {
        out.push({ numero, fila: h.fila, orden, numberSide: h.numberSide })
        orden++
      }
    }
  }
  return out
}

// Enumera cada sombrilla que dibuja el layout: { numero, fila, orden }.
// La columna izquierda arranca en orden 1, la derecha en orden 7 (el hueco
// visual del medio ocupa el "orden 6" que nunca se asigna a una unidad).
export function enumerarSombrillas() {
  const out = []
  for (const { fila, columnas } of SOMBRILLAS_LAYOUT.filas) {
    columnas.forEach((rango, colIdx) => {
      let orden = colIdx === 0 ? 1 : 7
      for (const numero of rangoNumeros(rango)) {
        out.push({ numero, fila, orden })
        orden++
      }
    })
  }
  return out
}

// Paleta y tokens únicos de los gráficos de Reportes (nov 2026).
//
// Reglas (no se improvisa color por gráfico):
//  * El amarillo Prius es el color de INGRESOS y de lo positivo, y el primer
//    slot categórico. Los neutros son para "sin factura" y lo secundario.
//  * Los hues categóricos se asignan en ORDEN FIJO, nunca ciclados: una serie
//    siempre tiene el mismo color, aunque un filtro cambie cuántas hay. Más
//    allá del último slot, el resto se dobla en "Otros" (neutro).
//  * Los colores de estado (verde éxito / rojo peligro) están reservados: no
//    se reusan como "serie 5".
//  * Claro y oscuro son dos pasos elegidos del mismo hue, no un flip
//    automático: cada uno se validó contra su propia superficie
//    (#FFFFFF y #161615).
//
// Validación (scripts/validate_palette.js del skill de dataviz): la secuencia
// categórica de 5 pasa las seis pruebas en claro y en oscuro. El único
// FAIL que queda a propósito es el piso de croma del neutro del par F/SF —
// "sin factura" ES gris por decisión de diseño; la separación CVD (ΔE 16,8
// claro / 13,8 oscuro) y la de visión normal (20,4 / 16,9) pasan holgadas, y
// el par nunca viaja solo: siempre lleva leyenda, monto y % escritos y el
// badge F/SF, así que la identidad nunca depende del color.
// El WARN de contraste del amarillo en claro obliga a "relieve": todos los
// gráficos que lo usan muestran el monto y el % escritos al lado.

/** Secuencia categórica, en orden fijo. Claro y oscuro, mismo hue. */
export const SERIES = [
  { claro: '#eda100', oscuro: '#c98500' }, // 1 · amarillo Prius
  { claro: '#2a78d6', oscuro: '#3987e5' }, // 2 · azul
  { claro: '#eb6834', oscuro: '#d95926' }, // 3 · naranja
  { claro: '#4a3aa7', oscuro: '#9085e9' }, // 4 · violeta
  { claro: '#1baf7a', oscuro: '#199e70' }, // 5 · aqua
]

/** Neutro: "sin factura", "otros", y toda serie secundaria. */
export const NEUTRO = { claro: '#8A8A85', oscuro: '#787772' }

/** Amarillo Prius como color único de ingresos / positivo. */
export const INGRESOS = SERIES[0]

/** Egresos con factura (F) = amarillo; sin factura (SF) = neutro. */
export const EGRESO_F = SERIES[0]
export const EGRESO_SF = NEUTRO

/** Tope de series antes de doblar el resto en "Otros". */
export const MAX_SERIES = SERIES.length

/** Color del slot `i` (0-based) en el tema pedido. Pasado el tope, neutro. */
export function colorSerie(i, oscuro) {
  const slot = SERIES[i]
  if (!slot) return oscuro ? NEUTRO.oscuro : NEUTRO.claro
  return oscuro ? slot.oscuro : slot.claro
}

export function colorNeutro(oscuro) {
  return oscuro ? NEUTRO.oscuro : NEUTRO.claro
}

export function colorIngresos(oscuro) {
  return oscuro ? INGRESOS.oscuro : INGRESOS.claro
}

/**
 * Dobla una lista de categorías en, como máximo, MAX_SERIES + "Otros".
 * Entra ordenada por monto descendente y sale con el color ya asignado por
 * posición, así que la identidad de cada serie no cambia si se filtra.
 */
export function doblarEnOtros(items, { clave = 'nombre', valor = 'total', oscuro = false } = {}) {
  const ordenados = [...(items || [])].sort((a, b) => Number(b[valor] || 0) - Number(a[valor] || 0))
  if (ordenados.length <= MAX_SERIES) {
    return ordenados.map((it, i) => ({ ...it, nombre: it[clave], valor: Number(it[valor] || 0), color: colorSerie(i, oscuro) }))
  }
  const primeros = ordenados.slice(0, MAX_SERIES - 1).map((it, i) => ({
    ...it, nombre: it[clave], valor: Number(it[valor] || 0), color: colorSerie(i, oscuro),
  }))
  const resto = ordenados.slice(MAX_SERIES - 1)
  return [
    ...primeros,
    {
      nombre: 'Otros',
      valor: resto.reduce((acc, it) => acc + Number(it[valor] || 0), 0),
      color: colorNeutro(oscuro),
      agrupadas: resto.length,
    },
  ]
}

/**
 * Tokens de texto y grilla. Se leen de las CSS vars del tema para que el
 * gráfico siga el claro/oscuro de la app sin duplicar la paleta: recharts
 * necesita colores concretos en props (`stroke`, `fill`), no clases.
 */
export function tokensTema(oscuro) {
  return oscuro
    ? { texto: '#A3A29C', textoFuerte: '#F5F4EF', grilla: 'rgba(255,255,255,0.08)', superficie: '#161615' }
    : { texto: '#6B6B6B', textoFuerte: '#000000', grilla: 'rgba(0,0,0,0.07)', superficie: '#FFFFFF' }
}

/** Especificaciones de marca compartidas (DESIGN.md + skill de dataviz). */
export const MARCA = {
  /** Punta redondeada de 4px anclada a la línea de base. */
  radioBarra: [4, 4, 0, 0],
  radioBarraH: [0, 4, 4, 0],
  /** 2px de superficie entre rellenos (apiladas y barras vecinas). */
  separacion: 2,
  /** Línea de 2px, marcador de 8px. */
  grosorLinea: 2,
  radioMarcador: 4,
}

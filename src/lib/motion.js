// Sistema de movimiento (nov 2026, Bloque 1 del rebranding Stitch).
// Las utilidades CSS viven en index.css (.anim-fade-up, .anim-stagger,
// .anim-press, .anim-colors, .skeleton-shimmer, .hover-row); acá está solo
// la parte que necesita JS: el delay de la entrada escalonada.

/** Tope de ítems animados en una lista y paso entre uno y otro. */
export const STAGGER_MAX = 12
export const STAGGER_STEP_MS = 30

/**
 * Delay de entrada para el ítem `i` de una lista.
 *
 * Corta en STAGGER_MAX: a partir de ahí el ítem entra sin delay. Con listas
 * largas el escalonado deja de leerse como pulido y pasa a leerse como que
 * la pantalla tarda — el último de 60 ítems entraría casi 2s después del
 * primero.
 *
 * Devuelve `undefined` cuando no corresponde animar, para poder escribir
 * `style={{ animationDelay: staggerDelay(i) }}` sin condicionales en el JSX.
 */
export function staggerDelay(i, total = 0) {
  // Listas de más de 50 elementos no se animan: el costo de componer 50+
  // animaciones a la vez se nota más que el efecto.
  if (total > 50) return undefined
  if (i >= STAGGER_MAX) return undefined
  return `${i * STAGGER_STEP_MS}ms`
}

/** `true` si la lista es lo bastante corta como para animar su entrada. */
export const puedeAnimarLista = (total) => total <= 50

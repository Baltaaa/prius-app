/**
 * Feature flags (Tarea 6, oct 2026) — único archivo que decide si una
 * feature nueva está activa. Todas en `true` por defecto. Apagar una
 * (poner `false` acá) tiene que dejar la app exactamente como estaba
 * antes de esa feature — ninguna feature nueva modifica un comportamiento
 * existente, solo agrega algo encima que se puede sacar sin tocar código.
 *
 * Cada feature vive en su propio commit `[feat-N] ...` y se consulta
 * siempre a través de `isFeatureEnabled(key)`, nunca importando el objeto
 * `FEATURES` directo en un componente (así un día se puede cambiar el
 * origen — env var, tabla remota — sin tocar cada call site).
 */
export const FEATURES = {
  'feat-1-search-global-mejorado': true,
  'feat-2-acciones-rapidas-contexto': true,
  'feat-3-drawer-cliente': true,
  'feat-4-recientes-home': true,
  'feat-5-ir-a-fecha': true,
  'feat-6-long-press-plano': true,
  'feat-7-caja-filtro-medio-url': true,
  'feat-8-leads-filtro-url': true,
  'feat-9-comprobantes-recordar-config': true,
  // Fase 3 reservas públicas: Recepción (check-in + cobro por QR/código).
  recepcion: true,
} as const

export type FeatureKey = keyof typeof FEATURES

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key] === true
}

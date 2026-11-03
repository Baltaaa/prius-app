// Bloque base del skeleton unificado por sección (B2, oct 2026) — gris
// (`bg-surface`, mismo token que el resto de la app) con
// pulso sutil de opacidad. Cada pantalla compone sus propios bloques con
// este componente, del tamaño/forma real de sus cards finales — no hay un
// "layout genérico" adivinado, cada pantalla arma el suyo a propósito.
// nov 2026: al pulso de opacidad se le suma el shimmer del sistema de
// movimiento (`.skeleton-shimmer`, index.css) — un brillo que cruza el
// bloque con translateX, compuesto por GPU. Se apaga solo con
// prefers-reduced-motion, igual que el resto de las animaciones.
export default function Skeleton({ className = '' }) {
  return <div className={`bg-surface rounded-card animate-pulse skeleton-shimmer ${className}`} />
}

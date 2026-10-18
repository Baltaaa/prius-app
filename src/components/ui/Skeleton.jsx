// Bloque base del skeleton unificado por sección (B2, oct 2026) — gris
// #F4F3F3 (`bg-prius-surface`, mismo token que el resto de la app) con
// pulso sutil de opacidad. Cada pantalla compone sus propios bloques con
// este componente, del tamaño/forma real de sus cards finales — no hay un
// "layout genérico" adivinado, cada pantalla arma el suyo a propósito.
export default function Skeleton({ className = '' }) {
  return <div className={`bg-prius-surface rounded-2xl animate-pulse ${className}`} />
}

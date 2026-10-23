import { useEffect, useRef } from 'react'

// Utilidad reutilizable (testing oct 2026, item 12): cada vez que un
// checkbox/switch al activarse revela campos nuevos debajo, esos campos
// tienen que aparecer con fade sutil y centrarse solos en el viewport —
// así no pasan desapercibidos, sobre todo dentro de modales con scroll
// propio (el campo puede nacer fuera de lo visible).
//
// Uso:
//   const revealRef = useRevealOnCheck(miCheckboxActivo)
//   {miCheckboxActivo && (
//     <div ref={revealRef} className="animate-premium-fade">...campos...</div>
//   )}
//
// `active`: el booleano que controla si el bloque está montado. El efecto
// solo actúa en la transición false→true (activación) — no hace nada al
// desactivar ni en el primer render si ya nace activo (nada que "aparecer"
// todavía, el usuario no acaba de interactuar).
export function useRevealOnCheck(active) {
  const ref = useRef(null)
  const wasActiveRef = useRef(active)

  useEffect(() => {
    const justActivated = active && !wasActiveRef.current
    wasActiveRef.current = active
    if (!justActivated) return
    // Un tick después del render para que el nodo ya esté pintado con su
    // tamaño real (mismo margen que ya usa useDeepLinkTarget/scrollAndHighlight
    // antes de medir dónde scrollear).
    const t = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [active])

  return ref
}

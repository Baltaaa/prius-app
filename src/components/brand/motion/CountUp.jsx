import { useEffect, useRef, useState } from 'react'

const DURACION_MS = 800

// Cuenta hasta `value` en 800ms con frenada suave. `format` es el formateador
// único de la app (pesos, porcentaje...), así el número nunca pierde formato
// mientras anima. Con prefers-reduced-motion muestra el valor final directo.
export default function CountUp({ value, format = (v) => v, className }) {
  const destino = Number(value) || 0
  const [actual, setActual] = useState(destino)
  const desde = useRef(0)

  useEffect(() => {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const origen = desde.current
    desde.current = destino
    if (quieto || origen === destino) { setActual(destino); return }

    let frame
    const inicio = performance.now()
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS)
      const frenada = 1 - (1 - t) ** 3
      setActual(t === 1 ? destino : origen + (destino - origen) * frenada)
      if (t < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [destino])

  return <span className={`tabular-nums whitespace-nowrap ${className || ''}`}>{format(actual)}</span>
}

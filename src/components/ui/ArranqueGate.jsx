import { useEffect, useRef, useState } from 'react'
import GlobalLoader from './GlobalLoader'
import { useAuth } from '../../context/AuthProvider'
import { useData } from '../../context/DataProvider'
import { useArranque } from '../../context/ArranqueProvider'

// Tope de seguridad: si algo no resuelve, la app se muestra igual.
const TIMEOUT_MS = 8000
// Mismo fade que usaba Login al reemplazar el árbol.
const FADE_MS = 250

// Recursos que no dependen de la red de Supabase: tipografía y logo. Se
// miden una sola vez por carga de página (promesa a nivel de módulo).
let recursosListos = null
function esperarRecursos() {
  if (recursosListos) return recursosListos
  const fuentes = document.fonts?.ready ?? Promise.resolve()
  const logo = new Promise((resolve) => {
    const img = new Image()
    img.onload = resolve
    img.onerror = resolve
    img.src = '/images/prius-icon.png'
    if (img.complete) resolve()
  })
  recursosListos = Promise.all([fuentes, logo])
  return recursosListos
}

/**
 * Loader global del arranque (nov 2026). Se queda arriba de todo hasta que la
 * primera pantalla está COMPLETA — sesión y rol, datos del DataProvider,
 * queries propias de la pantalla (ver ArranqueProvider), fuentes y logo — y
 * recién ahí hace el fade de 250ms con la pantalla ya armada debajo. Los
 * skeletons quedan para las navegaciones posteriores: en el arranque nunca se
 * ven, porque están tapados.
 *
 * Una sola vez por carga de página: volver a la pestaña o navegar no lo
 * vuelve a mostrar (`yaArranco` en ArranqueProvider).
 */
export default function ArranqueGate() {
  const { loading: authLoading, perfil } = useAuth()
  const { loading: datosLoading } = useData()
  const arranque = useArranque()
  const [listo, setListo] = useState(() => arranque?.yaArranco() ?? true)
  const [montado, setMontado] = useState(() => !(arranque?.yaArranco() ?? true))
  const [recursos, setRecursos] = useState(false)
  const vencidoRef = useRef(false)
  const [vencido, setVencido] = useState(false)

  useEffect(() => {
    if (listo) return undefined
    let vivo = true
    esperarRecursos().then(() => { if (vivo) setRecursos(true) })
    const t = setTimeout(() => {
      if (!vivo) return
      vencidoRef.current = true
      setVencido(true)
    }, TIMEOUT_MS)
    return () => { vivo = false; clearTimeout(t) }
  }, [listo])

  const todoResuelto =
    !authLoading && !!perfil && !datosLoading && recursos && (arranque?.pantallasPendientes ?? 0) === 0

  useEffect(() => {
    if (listo || !(todoResuelto || vencido)) return undefined
    setListo(true)
    arranque?.marcarArrancado()
    const t = setTimeout(() => setMontado(false), FADE_MS)
    return () => clearTimeout(t)
  }, [listo, todoResuelto, vencido, arranque])

  if (!montado) return null
  return (
    <div
      aria-hidden={listo}
      className="fixed inset-0 z-[9999] transition-opacity duration-[250ms]"
      style={{ opacity: listo ? 0 : 1, pointerEvents: listo ? 'none' : 'auto' }}
    >
      <GlobalLoader message="Preparando tu día" />
    </div>
  )
}

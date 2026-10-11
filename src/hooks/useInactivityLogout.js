import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import { markActivity, getLastActivity, broadcastLogout, subscribeActivityChannel } from '../lib/activity'
import { INACTIVITY_TIMEOUT_MS, WARNING_BEFORE_MS, CHECK_INTERVAL_MS } from '../config/session'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel']
const THROTTLE_MS = 1000

// Tarea 3 (oct 2026): cierre de sesión por inactividad. Montado una sola vez
// en el layout autenticado (nunca en el login). No usa solo setTimeout
// porque en mobile los timers se congelan con la app en segundo plano — el
// tiempo real transcurrido se mide siempre contra el timestamp guardado en
// localStorage, chequeado por intervalo + visibilitychange + focus.
export function useInactivityLogout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const lastThrottleRef = useRef(0)
  const expiredRef = useRef(false)

  const expirar = useCallback(async () => {
    if (expiredRef.current) return
    expiredRef.current = true
    setWarning(false)
    broadcastLogout()
    try { supabase.removeAllChannels() } catch { /* noop */ }
    await signOut('logout_inactividad')
    navigate('/login?motivo=inactividad', { replace: true })
  }, [signOut, navigate])

  const continuar = useCallback(() => {
    markActivity()
    setWarning(false)
  }, [])

  const check = useCallback(() => {
    if (expiredRef.current) return
    const last = getLastActivity()
    if (last === null) return
    const elapsed = Date.now() - last
    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      expirar()
      return
    }
    const restante = INACTIVITY_TIMEOUT_MS - elapsed
    if (restante <= WARNING_BEFORE_MS) {
      setWarning(true)
      setSecondsLeft(Math.ceil(restante / 1000))
    } else {
      setWarning(false)
    }
  }, [expirar])

  useEffect(() => {
    if (getLastActivity() === null) markActivity()

    const onActivity = () => {
      const now = Date.now()
      if (now - lastThrottleRef.current < THROTTLE_MS) return
      lastThrottleRef.current = now
      // Mientras el modal de aviso está abierto, la actividad de fondo (ej.
      // scroll residual) no debe renovarla en silencio: solo "Seguir
      // conectado" (o el click afuera, que dispara lo mismo) cuenta ahí.
      if (warning) return
      markActivity()
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }))

    const interval = setInterval(check, CHECK_INTERVAL_MS)
    const onVisibility = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    const unsubscribeChannel = subscribeActivityChannel((e) => {
      if (e.data?.type === 'logout') {
        expirar()
      } else if (e.data?.type === 'activity') {
        // A diferencia de `onActivity` (eventos locales, silenciados acá
        // mientras el aviso está abierto a propósito), la actividad real en
        // OTRA pestaña sí tiene que renovar y cerrar el aviso de esta: es
        // evidencia de que la persona sigue frente al dispositivo (bug
        // real de QA, oct 2026 — el aviso quedaba abierto en la pestaña
        // idle aunque la otra ya hubiera renovado el timestamp).
        check()
      }
    })

    check()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity))
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      unsubscribeChannel()
    }
  }, [warning, check, expirar])

  return { warning, secondsLeft, continuar, cerrarSesion: expirar }
}

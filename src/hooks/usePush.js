import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { claveAplicacion } from '../config/push'

// Web Push desde el navegador (nov 2026).
//
// En iPhone esto SOLO funciona con la app abierta desde la pantalla de inicio
// (iOS 16.4+): en Safari normal `Notification` ni siquiera existe. El hook
// devuelve `soportado` y `requiereInstalar` para que la tarjeta de
// Configuración lo explique en vez de ofrecer un botón que no va a andar.
//
// El permiso se pide SIEMPRE desde el tap del usuario (`activar`), nunca al
// cargar la pantalla: pedirlo solo es, además de molesto, la forma más rápida
// de que el navegador lo bloquee para siempre.

function esStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true
}

function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function usePush() {
  const [permiso, setPermiso] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'default'))
  const [suscripto, setSuscripto] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState(null)

  const soportado = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && typeof Notification !== 'undefined'

  // En iPhone, sin instalar, no hay push: hay que explicarlo, no ocultarlo.
  const requiereInstalar = esIOS() && !esStandalone()

  useEffect(() => {
    if (!soportado) return
    let vivo = true
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (vivo) setSuscripto(!!sub) })
      .catch(() => { /* sin service worker todavía: simplemente no hay suscripción */ })
    return () => { vivo = false }
  }, [soportado])

  const activar = useCallback(async () => {
    setError(null)
    setTrabajando(true)
    try {
      const resultado = await Notification.requestPermission()
      setPermiso(resultado)
      if (resultado !== 'granted') {
        setError('No nos diste permiso para mandarte avisos. Lo podés cambiar en los ajustes del navegador.')
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAplicacion(),
      })

      const json = sub.toJSON()
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error('Tenés que estar logueado para activar los avisos.')

      // `endpoint` es único: reinstalar la app en el mismo dispositivo
      // reemplaza la suscripción vieja en vez de duplicarla.
      const { error: err } = await supabase.from('push_suscripciones').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
      }, { onConflict: 'endpoint' })
      if (err) throw err

      setSuscripto(true)
      return true
    } catch (err) {
      setError(err.message || 'No pudimos activar los avisos.')
      return false
    } finally {
      setTrabajando(false)
    }
  }, [])

  const desactivar = useCallback(async () => {
    setTrabajando(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSuscripto(false)
    } catch (err) {
      setError(err.message || 'No pudimos desactivar los avisos.')
    } finally {
      setTrabajando(false)
    }
  }, [])

  return { soportado, requiereInstalar, permiso, suscripto, trabajando, error, activar, desactivar }
}

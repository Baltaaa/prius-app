// Web Push (nov 2026).
//
// La clave pública VAPID es pública por definición: va en el bundle y el
// navegador la usa como `applicationServerKey` al suscribirse. La privada
// vive SOLO como secret de la Edge Function `notificar-cierre-caja` (ver
// vapid.local.json, que no se commitea).
//
// Se puede pisar con VITE_VAPID_PUBLIC_KEY si alguna vez hay que rotarla sin
// tocar el código.
export const VAPID_PUBLIC_KEY: string =
  import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BEPrbt9lr6KLumRoMAZfNdzCcEgqy2LBpJ6QLOQgfA760B65bUjed1eMYcHwBwvTezDwKJQsWiPY6XxwW5wll1w'

/** base64url -> Uint8Array, que es lo que pide `pushManager.subscribe`. */
export function claveAplicacion(base64: string = VAPID_PUBLIC_KEY): Uint8Array {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

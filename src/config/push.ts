// Web Push (nov 2026).
//
// La clave pública VAPID es pública por definición: va en el bundle y el
// navegador la usa como `applicationServerKey` al suscribirse.
//
// La privada NUNCA estuvo acá ni en ningún archivo local: el par se generó
// dentro de Supabase y la privada vive solo en el vault
// (`prius_vapid_private_key`), de donde la lee `notificar-cierre-caja` vía
// `fn_secrets_notificaciones()`. Para rotar el par, se regenera ahí y se
// pega la pública nueva acá — es lo único que tiene que viajar.
//
// Se puede pisar con VITE_VAPID_PUBLIC_KEY si alguna vez hay que rotarla sin
// tocar el código.
export const VAPID_PUBLIC_KEY: string =
  import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BC7U2H52yXbK1CaJs11q7wvHdj1f41dvUcBUTWSsA5-wEaWVcJROidQCKqAi--SfOscmdYM9HKy8g8u5s6rKnBU'

/** base64url -> Uint8Array, que es lo que pide `pushManager.subscribe`. */
export function claveAplicacion(base64: string = VAPID_PUBLIC_KEY): Uint8Array {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(normal)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

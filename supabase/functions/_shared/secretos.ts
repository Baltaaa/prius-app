import { createClient } from "jsr:@supabase/supabase-js@2"

// Secrets de notificaciones, leídos del vault (nov 2026, fase 1).
//
// Por qué del vault y no de `Deno.env`: el cron ya saca el secret interno de
// vault (fn_disparar_notificaciones). Tener la mitad de los valores ahí y la
// otra mitad en los secrets de la función es la forma más segura de que se
// desincronicen — y rotar obligaría a tocar dos lados. Con todo en el vault
// hay UN solo lugar donde mirar y rotar.
//
// `Deno.env` igual gana si está: sirve para probar algo puntual sin tocar la
// base. Pero nada depende de eso — sin una sola variable de entorno, las
// funciones andan igual.
//
// Los secrets de WhatsApp NO pasan por acá: siguen en `Deno.env`, porque son
// credenciales de Meta que el dueño carga desde el panel.

export type SecretosNotificaciones = {
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  INTERNAL_SECRET: string
}

const NOMBRES = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "INTERNAL_SECRET"] as const

// Caché por instancia: una Edge Function atiende varios requests con el mismo
// isolate, y no tiene sentido pegarle a la base por cada uno. Se pierde sola
// cuando la instancia se recicla, que es también la forma de que una rotación
// entre sin redeployar.
let cache: SecretosNotificaciones | null = null

export async function leerSecretos(): Promise<SecretosNotificaciones> {
  if (cache) return cache

  const desdeEnv = Object.fromEntries(
    NOMBRES.map((n) => [n, Deno.env.get(n) ?? ""]),
  ) as SecretosNotificaciones

  // Si el entorno ya trae los cuatro, no hace falta ir a la base.
  if (NOMBRES.every((n) => desdeEnv[n])) {
    cache = desdeEnv
    return cache
  }

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await sb.rpc("fn_secrets_notificaciones")
  if (error) {
    console.error("[secretos] no se pudo leer el vault:", error.message)
  }

  // El entorno pisa al vault valor por valor, no todo o nada.
  const vault = (data ?? {}) as Partial<SecretosNotificaciones>
  cache = Object.fromEntries(
    NOMBRES.map((n) => [n, desdeEnv[n] || vault[n] || ""]),
  ) as SecretosNotificaciones

  return cache
}

/** Vacía la caché. Solo para tests. */
export function olvidarSecretos(): void {
  cache = null
}
